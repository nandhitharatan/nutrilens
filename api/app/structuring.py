import os
import json
import logging
import re
from typing import List, Dict, Set, Any
from .label_safety import Line

logger = logging.getLogger(__name__)

ALLOWED_FIELDS = {"ingredient", "allergen", "nutrition", "serving_size", "product_name"}
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

def structure_lines(lines: List[Line]) -> List[Line]:
    """
    Structures OCR lines by classifying which line IDs belong to which field using Google Gemini.
    Only passes line IDs and text to Gemini.
    Returns IDs per field only.
    Strictly validates that any returned ID must exist in the input lines.
    Rejects any nonexistent IDs.
    Gemini NEVER supplies text or coordinates.
    """
    if not lines:
        return lines

    valid_id_map = {l.id: l for l in lines}
    valid_ids: Set[int] = set(valid_id_map.keys())

    field_to_ids: Dict[str, List[int]] = {}
    api_key = os.getenv("GEMINI_API_KEY")

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
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
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )
            raw_text = (response.text or "").strip()
            # Clean possible markdown code fences if model enclosed JSON
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
                raw_text = re.sub(r"\n?```$", "", raw_text)

            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                for fld, ids in parsed.items():
                    if fld in ALLOWED_FIELDS and isinstance(ids, list):
                        # Filter strictly to valid existing IDs
                        field_to_ids[fld] = [
                            int(i)
                            for i in ids
                            if isinstance(i, (int, str)) and str(i).isdigit() and int(i) in valid_ids
                        ]
        except Exception as exc:
            logger.error("Gemini structuring failed: %s", exc, exc_info=True)
            field_to_ids = {}

    # If Gemini classification did not run or returned empty, use deterministic local heuristics
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
    """
    Deterministic local classifier as fallback or test mode.
    Handles 0-based and 1-based line numbers and case-insensitive allergen matches.
    """
    field_to_ids: Dict[str, List[int]] = {f: [] for f in ALLOWED_FIELDS}
    in_ingredients = False

    for idx, l in enumerate(lines):
        text_lower = (l.text or "").lower()

        # Case-insensitive check for allergens with or without colons
        if re.search(r"\b(contains:?|allergen:?|allergens:?|may contain:?)\b", text_lower, re.IGNORECASE):
            field_to_ids["allergen"].append(l.id)
            in_ingredients = False
        elif any(term in text_lower for term in ["serving size", "servings per", "per serving"]):
            field_to_ids["serving_size"].append(l.id)
            in_ingredients = False
        elif any(term in text_lower for term in ["ingredients:", "ingredients", "constituents", "made of"]):
            field_to_ids["ingredient"].append(l.id)
            in_ingredients = True
        elif any(term in text_lower for term in ["calories", "total fat", "sodium", "total carb", "daily value", "nutrition facts"]) or re.search(r"\bprotein\s*[:\d]|\b\d+\s*g\b", text_lower, re.IGNORECASE):
            field_to_ids["nutrition"].append(l.id)
            in_ingredients = False
        elif in_ingredients:
            # Lines immediately continuing the ingredient list
            field_to_ids["ingredient"].append(l.id)
        elif idx == 0 or l.id in (0, 1):
            # Supports both 0-based and 1-based indexing for product_name
            field_to_ids["product_name"].append(l.id)

    return field_to_ids
