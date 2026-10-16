import os
import json
import re
from typing import List, Dict, Set, Any
from .label_safety import Line

ALLOWED_FIELDS = {"ingredient", "allergen", "nutrition", "serving_size", "product_name"}

def structure_lines(lines: List[Line]) -> List[Line]:
    """
    Structures OCR lines by classifying which line IDs belong to which field.
    Only passes line IDs and text to Claude.
    Returns IDs per field only.
    Strictly validates that any returned ID must exist in the input lines.
    Rejects any nonexistent IDs.
    Claude NEVER supplies text or coordinates.
    """
    if not lines:
        return lines

    valid_id_map = {l.id: l for l in lines}
    valid_ids: Set[int] = set(valid_id_map.keys())

    field_to_ids: Dict[str, List[int]] = {}
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            prompt_lines = "\n".join([f"ID {l.id}: {l.text}" for l in lines])
            prompt = f"""You are a strict data classifier for packaged food labels.
You are given OCR line IDs and their text:
{prompt_lines}

Classify which line IDs belong to each field:
- ingredient: lines containing ingredients or ingredient lists
- allergen: lines containing allergen warnings, contains/may contain statements
- nutrition: lines containing nutrition facts, macros, vitamins, percentages
- serving_size: lines specifying serving size or servings per container
- product_name: line containing the product brand or title

Return ONLY a JSON object mapping each field to an array of existing integer line IDs:
{{
  "ingredient": [id, ...],
  "allergen": [id, ...],
  "nutrition": [id, ...],
  "serving_size": [id, ...],
  "product_name": [id, ...]
}}

CRITICAL RULES:
1. ONLY return integer line IDs that appear in the input list above. Reject or omit any nonexistent IDs.
2. If a field is not found or ambiguous, use an empty array [].
3. DO NOT return coordinates, bounding boxes, or new text.
4. Output valid JSON only, no markdown, no other commentary.
"""
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            raw_text = response.content[0].text.strip()
            # Clean possible markdown blocks
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
                raw_text = re.sub(r"\n?```$", "", raw_text)
            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                for fld, ids in parsed.items():
                    if fld in ALLOWED_FIELDS and isinstance(ids, list):
                        # Filter to strictly valid existing IDs
                        field_to_ids[fld] = [int(i) for i in ids if isinstance(i, (int, str)) and str(i).isdigit() and int(i) in valid_ids]
        except Exception:
            field_to_ids = {}

    # If Claude classification did not run or returned empty, use deterministic local heuristics
    if not field_to_ids:
        field_to_ids = _local_heuristic_structuring(lines)

    # Apply strictly validated field IDs to Line objects
    for field_name, assigned_ids in field_to_ids.items():
        if field_name not in ALLOWED_FIELDS:
            continue
        for line_id in assigned_ids:
            if line_id in valid_id_map:
                valid_id_map[line_id].field = field_name

    return lines


def _local_heuristic_structuring(lines: List[Line]) -> Dict[str, List[int]]:
    """Deterministic local classifier as fallback or test mode."""
    field_to_ids: Dict[str, List[int]] = {f: [] for f in ALLOWED_FIELDS}
    in_ingredients = False

    for l in lines:
        upper = l.text.upper()
        if any(term in upper for term in ["SERVING SIZE", "SERVINGS PER", "PER SERVING"]):
            field_to_ids["serving_size"].append(l.id)
            in_ingredients = False
        elif any(term in upper for term in ["CONTAINS:", "MAY CONTAIN:", "ALLERGEN:"]):
            field_to_ids["allergen"].append(l.id)
            in_ingredients = False
        elif any(term in upper for term in ["INGREDIENTS:", "INGREDIENTS", "CONSTITUENTS", "MADE OF"]):
            field_to_ids["ingredient"].append(l.id)
            in_ingredients = True
        elif any(term in upper for term in ["CALORIES", "TOTAL FAT", "SODIUM", "TOTAL CARB", "PROTEIN", "DAILY VALUE", "NUTRITION FACTS"]):
            field_to_ids["nutrition"].append(l.id)
            in_ingredients = False
        elif in_ingredients:
            # Lines immediately continuing the ingredient list
            field_to_ids["ingredient"].append(l.id)
        elif l.id == 1 or (lines and l == lines[0]):
            field_to_ids["product_name"].append(l.id)

    return field_to_ids
