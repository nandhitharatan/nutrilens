import io
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from api.app.main import app
from api.app.db import db
from api.app.label_safety import Line
from api.app.structuring import structure_lines

client = TestClient(app)

def create_test_image(width=700, height=700, text="", sharp=True):
    """Creates an in-memory JPEG image for testing."""
    img = Image.new("RGB", (width, height), color=(180, 180, 180))
    draw = ImageDraw.Draw(img)
    if sharp:
        for i in range(0, min(width, height), 25):
            draw.line([(i, 0), (i, height)], fill=(40, 40, 40), width=2)
            draw.line([(0, i), (width, i)], fill=(40, 40, 40), width=2)
    if text:
        draw.text((50, 50), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# 1. /scan retake when image fails quality checks (blurry / too small)
def test_scan_retake_on_small_image():
    # An image smaller than 600x600 fails check_image with 'too_small'
    small_bytes = create_test_image(width=400, height=400)
    files = {"file": ("small.jpg", small_bytes, "image/jpeg")}
    res = client.post("/scan", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "retake"
    assert "too_small" in data["reasons"]
    assert data["scan_id"] is None


def test_scan_retake_on_dark_image():
    # An almost black image
    dark_img = Image.new("RGB", (700, 700), color=(10, 10, 10))
    buf = io.BytesIO()
    dark_img.save(buf, format="JPEG")
    files = {"file": ("dark.jpg", buf.getvalue(), "image/jpeg")}
    res = client.post("/scan", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "retake"
    assert "too_dark" in data["reasons"]


# 2. /scan success and box creation
def test_scan_success_and_boxes():
    img_bytes = create_test_image(700, 700, text="INGREDIENTS: Wheat flour, sugar, salt.\nCONTAINS: Wheat.")
    files = {"file": ("label.jpg", img_bytes, "image/jpeg")}
    res = client.post("/scan", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "action" in data
    assert data["scan_id"] is not None
    assert "lines" in data
    # Verify scan saved in database
    scan_row = db.get_scan(data["scan_id"])
    assert scan_row is not None


# 3. /scan/{id}/confirm saves user corrections
def test_scan_confirm_correction():
    # Create scan and save a box
    scan = db.create_scan()
    scan_id = scan["id"]
    db.save_boxes(scan_id, [
        {"line_no": 1, "text": "INGREDIENTS: wh3at flour", "ocr_confidence": 0.45, "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.05, "field": "ingredient"}
    ])

    res = client.post(f"/scan/{scan_id}/confirm", json={
        "corrections": {"1": "INGREDIENTS: wheat flour"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "reviewed"
    
    # Check that user_corrected is set to True
    boxes = db.get_boxes(scan_id)
    assert len(boxes) == 1
    assert boxes[0]["user_corrected"] is True
    assert boxes[0]["corrected_text"] == "INGREDIENTS: wheat flour"


# 4. /analyze re-run after correction
def test_analyze_rerun_after_correction():
    scan = db.create_scan()
    scan_id = scan["id"]
    # Save boxes with typo in uncertain ingredient
    db.save_boxes(scan_id, [
        {"line_no": 1, "text": "INGREDIENTS: wheat, sug@r, p3anut oil", "ocr_confidence": 0.50, "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.05, "field": "ingredient"},
        {"line_no": 2, "text": "Nutrition Facts", "ocr_confidence": 0.95, "x": 0.1, "y": 0.3, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 3, "text": "Calories 150", "ocr_confidence": 0.95, "x": 0.1, "y": 0.35, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 4, "text": "Total Fat 5g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.4, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 5, "text": "Sodium 100mg", "ocr_confidence": 0.95, "x": 0.1, "y": 0.45, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 6, "text": "Protein 3g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.5, "w": 0.3, "h": 0.03, "field": "nutrition"},
    ])

    # First analysis with uncorrected text: "p3anut" doesn't match peanut, and line is uncertain -> result is unknown
    res1 = client.post("/analyze", json={
        "scan_id": scan_id,
        "user_allergens": ["peanut"]
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["overall_status"] == "unknown"
    assert data1["findings"][0]["result"] == "unknown"

    # Re-run after user correction: user fixes "p3anut oil" -> "peanut oil"
    res2 = client.post("/analyze", json={
        "scan_id": scan_id,
        "user_allergens": ["peanut"],
        "corrections": {"1": "INGREDIENTS: wheat, sugar, peanut oil"}
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["overall_status"] == "conflict_found"
    assert data2["findings"][0]["result"] == "conflict_found"
    assert data2["findings"][0]["evidence"][0]["certainty"] == "user_confirmed"


# 5. Missing OCR output is NEVER treated as proof of absence (Missing = Unknown, never safe)
def test_missing_ocr_is_never_safe():
    scan = db.create_scan()
    scan_id = scan["id"]
    # Only nutrition lines, no ingredient or allergen lines
    db.save_boxes(scan_id, [
        {"line_no": 1, "text": "Calories 200", "ocr_confidence": 0.95, "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 2, "text": "Total Fat 8g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.25, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 3, "text": "Sodium 150mg", "ocr_confidence": 0.95, "x": 0.1, "y": 0.3, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 4, "text": "Protein 4g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.35, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 5, "text": "Total Carbohydrate 25g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.4, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 6, "text": "Serving Size 1 bar", "ocr_confidence": 0.95, "x": 0.1, "y": 0.45, "w": 0.3, "h": 0.03, "field": "serving_size"},
    ])

    res = client.post("/analyze", json={
        "scan_id": scan_id,
        "user_allergens": ["peanut", "milk"]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == "unknown"
    for finding in data["findings"]:
        assert finding["result"] == "unknown"
        assert "not found" in finding["reason"] or "unclear" in finding["reason"]
        assert finding["evidence"] == []


# 6. Claude structuring validation: rejects nonexistent IDs
def test_structuring_rejects_invented_ids():
    lines = [
        Line(id=1, text="INGREDIENTS: Organic Oats, Almonds", conf=0.95, x=0.1, y=0.1, w=0.5, h=0.05),
        Line(id=2, text="CONTAINS: Tree nuts", conf=0.95, x=0.1, y=0.2, w=0.5, h=0.05),
    ]
    structured = structure_lines(lines)
    for l in structured:
        # Every line has a valid ID that was in the input
        assert l.id in {1, 2}


# 7. Edge cut-off flags uncertain and asks for manual confirmation
def test_edge_cut_off_ingredient_asks_confirmation():
    scan = db.create_scan()
    scan_id = scan["id"]
    # x + w = 0.99 touches the right border
    db.save_boxes(scan_id, [
        {"line_no": 1, "text": "INGREDIENTS: Wheat flour, sugar, salt, spi", "ocr_confidence": 0.95, "x": 0.6, "y": 0.2, "w": 0.39, "h": 0.05, "field": "ingredient"},
        {"line_no": 2, "text": "Nutrition Facts", "ocr_confidence": 0.95, "x": 0.1, "y": 0.3, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 3, "text": "Calories 150", "ocr_confidence": 0.95, "x": 0.1, "y": 0.35, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 4, "text": "Total Fat 5g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.4, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 5, "text": "Sodium 100mg", "ocr_confidence": 0.95, "x": 0.1, "y": 0.45, "w": 0.3, "h": 0.03, "field": "nutrition"},
        {"line_no": 6, "text": "Protein 3g", "ocr_confidence": 0.95, "x": 0.1, "y": 0.5, "w": 0.3, "h": 0.03, "field": "nutrition"},
    ])

    res = client.post("/analyze", json={
        "scan_id": scan_id,
        "user_allergens": ["peanut"]
    })
    assert res.status_code == 200
    data = res.json()
    # Edge touching makes ingredient list uncertain, so peanut cannot be ruled out => unknown
    assert data["overall_status"] == "unknown"
    assert "unclear or may be cut off" in data["findings"][0]["reason"]


# 8. /explain endpoint produces [AI] tagged explanation
def test_explain_endpoint_has_ai_tag():
    res = client.post("/explain", json={
        "allergen": "peanut",
        "rule_detail": "Cannot rule out 'peanut': ingredient list is unclear",
        "label_text": "wh3at fl0ur, p3anut"
    })
    assert res.status_code == 200
    data = res.json()
    assert "explanation" in data
    assert data["explanation"].startswith("[AI]")


# 9. /scan/{id} returns details and boxes
def test_get_scan_details():
    scan = db.create_scan()
    scan_id = scan["id"]
    res = client.get(f"/scan/{scan_id}")
    assert res.status_code == 200
    data = res.json()
    assert "scan" in data
    assert "lines" in data
    assert data["scan"]["id"] == scan_id

