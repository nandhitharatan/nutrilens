from label_safety import (Line, ImageCheck, evaluate_allergens, overall_status,
                          next_action, field_status, reanalyze_after_correction)


def ing(text, conf=0.95, x=0.1, y=0.4, w=0.5, h=0.05, id=1):
    return Line(id, text, conf, x, y, w, h, field="ingredient")


def filler(n=6):  # enough lines so OCR isn't judged "poor"
    return [Line(100 + i, "x", 0.95, 0.1, 0.1 + i * 0.05, 0.3, 0.03, field="nutrition") for i in range(n)]


# --- missing / incomplete OCR is never "safe" ---
def test_no_lines_is_unknown_and_invents_nothing():
    f = evaluate_allergens(["milk"], [])
    assert f[0].result == "unknown" and f[0].evidence == []
    assert overall_status(f, []) == "unknown"


def test_missing_ingredients_is_unknown_even_with_no_allergens():
    lines = filler()
    assert overall_status(evaluate_allergens([], lines), lines) == "unknown"


def test_low_confidence_ingredients_is_unknown():
    lines = [ing("wheat flour, sugar", conf=0.5)] + filler()
    f = evaluate_allergens(["peanut"], lines)
    assert f[0].result == "unknown"
    assert field_status(lines, "ingredient") == "uncertain"


def test_ingredients_at_photo_edge_flagged_possibly_cut_off():
    lines = [ing("wheat flour, sugar", x=0.5, w=0.5)]  # x+w = 1.0
    assert field_status(lines, "ingredient") == "uncertain"


# --- clear label ---
def test_clear_ingredients_without_allergen_is_no_known_conflict():
    lines = [ing("wheat flour, sugar, salt")] + filler()
    f = evaluate_allergens(["peanut"], lines)
    assert f[0].result == "no_known_conflict"
    assert overall_status(f, lines) == "no_known_conflict"


def test_alias_hit_is_conflict_with_evidence():
    lines = [ing("sugar, whey powder, salt")] + filler()
    f = evaluate_allergens(["milk"], lines)
    assert f[0].result == "conflict_found"
    assert f[0].evidence[0]["certainty"] == "confirmed"


def test_hit_in_uncertain_line_still_conflict_but_marked_uncertain():
    lines = [ing("sugar, peanut oil", conf=0.5)] + filler()
    f = evaluate_allergens(["peanut"], lines)
    assert f[0].result == "conflict_found"
    assert f[0].evidence[0]["certainty"] == "uncertain"


# --- retake / manual confirm ---
def test_blurry_image_asks_retake():
    assert next_action(ImageCheck(False, ["blurry"]), filler())["action"] == "retake"


def test_unclear_ingredients_ask_manual_confirmation():
    lines = [ing("wh3at fl0ur", conf=0.4)] + filler()
    r = next_action(ImageCheck(True, []), lines)
    assert r == {"action": "confirm_manually", "fields": ["ingredient"]}


def test_clear_label_proceeds():
    assert next_action(ImageCheck(True, []), [ing("sugar")] + filler())["action"] == "proceed"


# --- user corrections update results ---
def test_correction_turns_unknown_into_conflict():
    lines = [ing("wheat flour, sugar, p3anut oil", conf=0.5)] + filler()
    assert evaluate_allergens(["peanut"], lines)[0].result == "unknown"
    f, overall = reanalyze_after_correction(["peanut"], lines, {1: "wheat flour, sugar, peanut oil"})
    assert f[0].result == "conflict_found"
    assert f[0].evidence[0]["certainty"] == "user_confirmed"
    assert overall == "conflict_found"


def test_correction_turns_unknown_into_no_known_conflict():
    lines = [ing("wheat flour, sugr", conf=0.5)] + filler()
    f, overall = reanalyze_after_correction(["peanut"], lines, {1: "wheat flour, sugar"})
    assert f[0].result == "no_known_conflict" and overall == "no_known_conflict"
