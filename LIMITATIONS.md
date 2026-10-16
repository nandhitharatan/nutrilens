# Nutrilens: Known Limitations & Verification

## What the system guarantees
- **Missing or unclear data is never safe:** Missing, unreadable, or low-confidence data is never reported as "safe" or "no conflict". The result is strictly *Unknown*.
- **Every flag shows exact label proof:** Every piece of evidence links to an exact OCR line from the image with fractional bounding boxes `(x, y, w, h)`, tagged with its certainty: `confirmed`, `uncertain`, or `user_confirmed`.
- **Zero AI hallucination in rules:** Google Gemini only labels which OCR line IDs belong to fields (`ingredient`, `allergen`, `nutrition`, `serving_size`, `product_name`). It never supplies text or coordinates, and the backend validates and strictly rejects any ID not in the original OCR output.
- **Rule engine is pure Python:** All safety checks (`evaluate_allergens`, `overall_status`, `next_action`) are deterministic Python with no LLM dependencies.
- **User corrections re-run rules:** Users can edit misread or unclear lines on `/scan/review`. Corrections are saved with `user_corrected = True`, re-run through the Python rules, and updated in the findings tagged as `user_confirmed`.
- **Design tokens enforced:** Light mode only, using Parchment (`#F1EDE4`), Oxblood (`#A23B32`), Ink (`#26231F`), and Gold (`#E3B95B`). No green or purple is used anywhere in the UI.

## What it cannot do
- **No direct 3D curvature or physical occlusion sensors:** Blur, darkness, glare, and small image size are measured directly on the image with OpenCV Laplacian variance, pixel mean, and luminance histograms. Curved packaging, partial occlusion, or wrapped bottles are caught indirectly through low OCR confidence (`< 0.80`), too few detected lines (`< 5`), or text touching within 2% of the photo border (`EDGE = 0.02`).
- **OCR can be confidently wrong:** An OCR line read at high confidence can occasionally contain a subtle typo. "No known conflict" strictly means "none found in the text read", not medical safety.
- **Alias list is focused:** The built-in alias dictionary covers common variants (e.g. `milk` -> `casein`, `whey`, `lactose`; `peanut` -> `groundnut`, `arachis`). Rare chemical derivatives or undisclosed manufacturing cross-contamination cannot be guaranteed.
- **User corrections are trusted:** If the user manually inputs incorrect text, the deterministic rule engine evaluates the user's input directly.
- **English packaging only:** Evaluated on English food labels. Not medical or pharmacological advice.

## Verification of "No Invented Label Information"
1. **Empty input test (`test_no_lines_is_unknown_and_invents_nothing`):**
   When 0 lines are provided, `evaluate_allergens` returns `result: "unknown"`, `evidence: []`, and `overall_status: "unknown"`.
2. **Missing ingredient list test (`test_missing_ingredients_is_unknown_even_with_no_allergens`):**
   Even with 0 user allergens, missing ingredient text evaluates to `unknown`, never safe.
3. **Low-confidence ingredients test (`test_low_confidence_ingredients_is_unknown`):**
   Uncertain lines flag `field_status: "uncertain"` and prevent false negative clearance.
4. **Edge cut-off detection test (`test_edge_cut_off_ingredient_asks_confirmation`):**
   Lines touching the photo perimeter (`x + w >= 0.98` or `x <= 0.02`) are flagged as potentially truncated and require manual confirmation.
5. **Google Gemini structuring ID rejection (`test_structuring_rejects_invented_ids`):**
   The backend filters all returned field classifications against the valid input line ID set, dropping any nonexistent or fabricated IDs.
