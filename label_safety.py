"""Nutrilens label safety core: quality checks, uncertainty flags, unknown-is-not-safe rules.

Drop into /api/app/. Pure Python except check_image (needs opencv-python-headless + numpy).
"""
import os
import re
from dataclasses import dataclass, field

OCR_MIN_CONF = float(os.getenv("OCR_MIN_CONFIDENCE", "0.80"))
EDGE = 0.02  # a line this close to the photo border may be cut off

# Tiny alias map. Extend it, but never treat "no alias hit" as proof of absence.
ALIASES = {
    "milk": {"casein", "caseinate", "whey", "lactose", "butter", "cream"},
    "peanut": {"peanuts", "groundnut", "arachis"},
    "soy": {"soya", "soybean", "soybeans", "lecithin (soy)"},
    "wheat": {"gluten", "semolina", "durum"},
    "egg": {"eggs", "albumen", "ovalbumin"},
}


# ---------- 1. Image quality (blurry / dark / glare / tiny) ----------
@dataclass
class ImageCheck:
    ok: bool
    issues: list
    blur_score: float = 0.0
    brightness: float = 0.0


def check_image(img_bytes: bytes) -> ImageCheck:
    import cv2
    import numpy as np

    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return ImageCheck(False, ["unreadable_file"])
    h, w = img.shape
    blur = float(cv2.Laplacian(img, cv2.CV_64F).var())
    mean = float(img.mean())
    glare = float((img > 245).mean())
    issues = []
    if min(h, w) < 600:
        issues.append("too_small")
    if blur < 100:  # tune on real photos
        issues.append("blurry")
    if mean < 60:
        issues.append("too_dark")
    if glare > 0.15:
        issues.append("glare")
    return ImageCheck(not issues, issues, blur, mean)


# ---------- 2. OCR lines, completeness, uncertainty ----------
@dataclass
class Line:
    id: int
    text: str
    conf: float
    x: float
    y: float
    w: float
    h: float
    field: str | None = None  # "ingredient", "allergen", "nutrition", "serving_size"...
    corrected_text: str | None = None  # set when the user fixes it on /scan/review

    @property
    def user_confirmed(self) -> bool:
        return self.corrected_text is not None

    @property
    def effective_text(self) -> str:
        return self.corrected_text if self.user_confirmed else self.text

    @property
    def uncertain(self) -> bool:
        return (not self.user_confirmed) and self.conf < OCR_MIN_CONF

    @property
    def touches_edge(self) -> bool:
        return (self.x < EDGE or self.y < EDGE
                or self.x + self.w > 1 - EDGE or self.y + self.h > 1 - EDGE)

    @property
    def certainty(self) -> str:
        if self.user_confirmed:
            return "user_confirmed"
        return "uncertain" if self.uncertain else "confirmed"


def field_status(lines: list, field_name: str) -> str:
    """'clear' | 'uncertain' | 'missing'. Missing means no line was found, NOT that it is absent on the label."""
    fl = [l for l in lines if l.field == field_name]
    if not fl:
        return "missing"
    if any(l.uncertain for l in fl):
        return "uncertain"
    if field_name == "ingredient" and any(l.touches_edge and not l.user_confirmed for l in fl):
        return "uncertain"  # possibly cut off at the photo border
    return "clear"


def ocr_poor(lines: list) -> bool:
    if len(lines) < 5:
        return True
    return sum(l.uncertain for l in lines) / len(lines) > 0.4


# ---------- 3. Ask for retake or manual confirmation ----------
def next_action(img: ImageCheck | None, lines: list) -> dict:
    if img is not None and not img.ok:
        return {"action": "retake", "reasons": img.issues}
    if ocr_poor(lines):
        return {"action": "retake", "reasons": ["ocr_poor"]}
    unresolved = []
    if field_status(lines, "ingredient") != "clear":
        unresolved.append("ingredient")
    if field_status(lines, "allergen") == "uncertain":  # allergen statement is optional on labels
        unresolved.append("allergen")
    if unresolved:
        return {"action": "confirm_manually", "fields": unresolved}
    return {"action": "proceed"}


# ---------- 4/5/6. Rules: unknown is never safe, evidence is always shown ----------
@dataclass
class Finding:
    allergen: str
    result: str  # "conflict_found" | "unknown" | "no_known_conflict"
    reason: str
    evidence: list = field(default_factory=list)  # [{line_id, text, certainty}]


def _hits(allergen: str, lines: list) -> list:
    terms = {allergen.lower()} | ALIASES.get(allergen.lower(), set())
    pats = [re.compile(rf"\b{re.escape(t)}\b", re.I) for t in terms]
    return [l for l in lines
            if l.field in ("ingredient", "allergen")
            and any(p.search(l.effective_text) for p in pats)]


def evaluate_allergens(user_allergens: list, lines: list) -> list:
    ing_status = field_status(lines, "ingredient")
    out = []
    for a in user_allergens:
        hits = _hits(a, lines)
        if hits:  # a hit is a conflict even in an uncertain line; evidence shows its certainty
            ev = [{"line_id": l.id, "text": l.effective_text, "certainty": l.certainty} for l in hits]
            note = " (found in text that is uncertain; please confirm)" if any(l.uncertain for l in hits) else ""
            out.append(Finding(a, "conflict_found", f"'{a}' or a related term appears on the label{note}", ev))
        elif ing_status != "clear":
            why = "ingredient list not found" if ing_status == "missing" else "ingredient list is unclear or may be cut off"
            out.append(Finding(a, "unknown", f"Cannot rule out '{a}': {why}", []))
        else:
            out.append(Finding(a, "no_known_conflict", f"No '{a}' term found in the clearly read ingredient list", []))
    return out


def overall_status(findings: list, lines: list) -> str:
    if any(f.result == "conflict_found" for f in findings):
        return "conflict_found"
    if field_status(lines, "ingredient") != "clear" or any(f.result == "unknown" for f in findings):
        return "unknown"
    return "no_known_conflict"


def reanalyze_after_correction(user_allergens: list, lines: list, corrections: dict) -> tuple:
    """corrections: {line_id: corrected_text}. Re-run the same rules on the corrected lines."""
    for l in lines:
        if l.id in corrections:
            l.corrected_text = corrections[l.id]
    f = evaluate_allergens(user_allergens, lines)
    return f, overall_status(f, lines)
