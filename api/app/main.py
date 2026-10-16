import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Union
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from .label_safety import (
    check_image, Line, next_action, evaluate_allergens,
    overall_status, reanalyze_after_correction, OCR_MIN_CONF, EDGE
)
from .ocr import run_ocr
from .structuring import structure_lines
from .db import db

logger = logging.getLogger(__name__)

app = FastAPI(title="Nutrilens API", version="1.0.0")

# CORS setup with ALLOWED_ORIGINS
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --- Models ---
class ConfirmRequest(BaseModel):
    corrections: Optional[Dict[str, str]] = None  # line_no as str -> corrected_text
    line_no: Optional[int] = None
    corrected_text: Optional[str] = None

class AnalyzeRequest(BaseModel):
    scan_id: str
    user_allergens: List[str] = []
    corrections: Optional[Dict[str, str]] = None

class ExplainRequest(BaseModel):
    finding_id: Optional[str] = None
    allergen: str
    rule_detail: str
    label_text: Optional[str] = None


# --- Endpoints ---
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Nutrilens API"}


@app.post("/scan")
async def scan_label(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form("00000000-0000-0000-0000-000000000001")
):
    """
    1. Runs check_image() on the upload.
    2. If it fails, returns {action: 'retake', reasons: [...]}.
    3. Otherwise saves image, runs OCR, saves lines to scan_boxes (x, y, w, h as fractions),
       builds Line objects, structures fields, and returns next_action().
    """
    img_bytes = await file.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    img_check = check_image(img_bytes)
    if not img_check.ok:
        return {
            "action": "retake",
            "reasons": img_check.issues,
            "blur_score": img_check.blur_score,
            "brightness": img_check.brightness,
            "scan_id": None
        }

    # Save image to disk
    scan_id = str(uuid.uuid4())
    filename = f"{scan_id}.jpg"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(img_bytes)

    # Create scan record
    scan_record = db.create_scan(scan_id=scan_id, image_path=filename, user_id=user_id, status="uploaded")

    # Run OCR
    raw_lines = run_ocr(img_bytes)

    # Build Line objects for structuring & safety check
    lines: List[Line] = []
    for rl in raw_lines:
        lines.append(Line(
            id=rl["line_no"],
            text=rl["text"],
            conf=rl["ocr_confidence"],
            x=rl["x"],
            y=rl["y"],
            w=rl["w"],
            h=rl["h"]
        ))

    # Structure lines (classify ingredient, allergen, nutrition, etc.)
    lines = structure_lines(lines)

    # Save to scan_boxes
    boxes_to_save = []
    for l in lines:
        boxes_to_save.append({
            "line_no": l.id,
            "text": l.text,
            "ocr_confidence": l.conf,
            "x": l.x,
            "y": l.y,
            "w": l.w,
            "h": l.h,
            "field": l.field,
            "source": "detected",
            "user_corrected": l.user_confirmed,
            "corrected_text": l.corrected_text
        })
    saved_boxes = db.save_boxes(scan_id, boxes_to_save, user_id=user_id)

    # Calculate next_action
    action_info = next_action(img_check, lines)

    # Format box response with uncertainty & edge flags
    formatted_boxes = []
    for sb in saved_boxes:
        is_uncertain = (not sb["user_corrected"]) and (sb["ocr_confidence"] < OCR_MIN_CONF)
        touches_edge = (
            sb["x"] < EDGE or sb["y"] < EDGE or
            (sb["x"] + sb["w"]) > (1 - EDGE) or (sb["y"] + sb["h"]) > (1 - EDGE)
        )
        formatted_boxes.append({
            **sb,
            "uncertain": is_uncertain,
            "touches_edge": touches_edge,
            "certainty": "user_confirmed" if sb["user_corrected"] else ("uncertain" if is_uncertain else "confirmed")
        })

    return {
        "action": action_info["action"],
        "reasons": action_info.get("reasons", []),
        "fields": action_info.get("fields", []),
        "scan_id": scan_id,
        "image_url": f"/uploads/{filename}",
        "lines": formatted_boxes
    }


@app.post("/scan/{scan_id}/confirm")
async def confirm_corrections(
    scan_id: str,
    payload: ConfirmRequest
):
    """
    Saves corrected_text and sets user_corrected = true in scan_boxes.
    """
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    corrections_map: Dict[int, str] = {}
    if payload.corrections:
        for k, v in payload.corrections.items():
            try:
                corrections_map[int(k)] = str(v)
            except ValueError:
                pass
    if payload.line_no is not None and payload.corrected_text is not None:
        corrections_map[payload.line_no] = payload.corrected_text

    for line_no, corrected_text in corrections_map.items():
        db.update_box_correction(scan_id, line_no, corrected_text)

    # Update scan status
    db.update_scan(scan_id, status="reviewed")

    boxes = db.get_boxes(scan_id)
    return {
        "scan_id": scan_id,
        "status": "reviewed",
        "updated_boxes": boxes
    }


@app.post("/analyze")
async def analyze_scan(payload: AnalyzeRequest):
    """
    Builds Line objects (applying corrections), calls evaluate_allergens() and overall_status(),
    saves findings (with box_ids as evidence) and scans.overall_status.
    """
    scan = db.get_scan(payload.scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Apply any inline corrections passed with analyze
    if payload.corrections:
        for k, v in payload.corrections.items():
            try:
                db.update_box_correction(payload.scan_id, int(k), str(v))
            except ValueError:
                pass

    boxes = db.get_boxes(payload.scan_id)
    line_no_to_box_id = {b["line_no"]: b["id"] for b in boxes}

    # Reconstruct Line objects from scan_boxes
    lines: List[Line] = []
    for b in boxes:
        lines.append(Line(
            id=b["line_no"],
            text=b["text"],
            conf=b["ocr_confidence"],
            x=b["x"],
            y=b["y"],
            w=b["w"],
            h=b["h"],
            field=b["field"],
            corrected_text=b["corrected_text"] if b["user_corrected"] else None
        ))

    # Evaluate allergens and overall status using label_safety rules
    findings = evaluate_allergens(payload.user_allergens, lines)
    status = overall_status(findings, lines)

    # Prepare findings for database storage
    db_findings = []
    response_findings = []
    for f in findings:
        box_ids = [line_no_to_box_id[ev["line_id"]] for ev in f.evidence if ev["line_id"] in line_no_to_box_id]
        finding_id = str(uuid.uuid4())
        db_findings.append({
            "id": finding_id,
            "rule_type": "allergen",
            "result": f.result,
            "title": f.allergen,
            "rule_detail": f.reason,
            "box_ids": box_ids,
            "ai_explanation": None
        })
        response_findings.append({
            "id": finding_id,
            "allergen": f.allergen,
            "result": f.result,
            "reason": f.reason,
            "evidence": f.evidence,
            "box_ids": box_ids
        })

    db.save_findings(payload.scan_id, db_findings, user_id=scan["user_id"])
    db.update_scan(payload.scan_id, overall_status=status, status="analyzed")

    formatted_boxes = []
    for b in boxes:
        is_uncertain = (not b["user_corrected"]) and (b["ocr_confidence"] < OCR_MIN_CONF)
        touches_edge = (
            b["x"] < EDGE or b["y"] < EDGE or
            (b["x"] + b["w"]) > (1 - EDGE) or (b["y"] + b["h"]) > (1 - EDGE)
        )
        formatted_boxes.append({
            **b,
            "uncertain": is_uncertain,
            "touches_edge": touches_edge,
            "certainty": "user_confirmed" if b["user_corrected"] else ("uncertain" if is_uncertain else "confirmed")
        })

    return {
        "scan_id": payload.scan_id,
        "overall_status": status,
        "findings": response_findings,
        "lines": formatted_boxes,
        "image_url": f"/uploads/{scan['image_path']}" if scan.get("image_path") else None
    }


@app.get("/scan/{scan_id}")
async def get_scan_details(scan_id: str):
    """
    Fetches scan info, boxes, and findings for the review or results page.
    """
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    boxes = db.get_boxes(scan_id)
    findings = db.get_findings(scan_id)

    formatted_boxes = []
    for b in boxes:
        is_uncertain = (not b["user_corrected"]) and (b["ocr_confidence"] < OCR_MIN_CONF)
        touches_edge = (
            b["x"] < EDGE or b["y"] < EDGE or
            (b["x"] + b["w"]) > (1 - EDGE) or (b["y"] + b["h"]) > (1 - EDGE)
        )
        formatted_boxes.append({
            **b,
            "uncertain": is_uncertain,
            "touches_edge": touches_edge,
            "certainty": "user_confirmed" if b["user_corrected"] else ("uncertain" if is_uncertain else "confirmed")
        })

    return {
        "scan": scan,
        "lines": formatted_boxes,
        "findings": findings,
        "image_url": f"/uploads/{scan['image_path']}" if scan.get("image_path") else None
    }


@app.post("/explain")
async def explain_finding(payload: ExplainRequest):
    """
    Generates a plain-language explanation for one finding, labeled with [AI].
    AI text is only for explanations and carries an 'AI' tag.
    Rule engine remains strictly plain Python.
    Caches the explanation in findings.ai_explanation and returns cached result on repeat calls.
    Returns { explanation: str, ai_used: bool }.
    """
    # 1. Return cached explanation on repeat calls
    if payload.finding_id:
        existing = db.get_finding(payload.finding_id)
        if existing and existing.get("ai_explanation"):
            return {
                "explanation": existing["ai_explanation"],
                "ai_used": True
            }

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            prompt = f"""Explain this food label safety flag simply in 1-2 concise sentences for a consumer:
Allergen: {payload.allergen}
Finding: {payload.rule_detail}
Matched label text: {payload.label_text or 'None'}

Be honest, direct, and remind the user this is not medical advice."""

            response = client.models.generate_content(
                model=model,
                contents=prompt
            )
            raw_text = (response.text or "").strip()
            explanation = f"[AI] {raw_text}"

            # Cache in findings database
            if payload.finding_id:
                db.update_finding_explanation(payload.finding_id, explanation)

            return {
                "explanation": explanation,
                "ai_used": True
            }
        except Exception as exc:
            logger.error("Gemini explain call failed: %s", exc, exc_info=True)
            return {
                "explanation": f"[AI] Nutrilens flagged '{payload.allergen}' because {payload.rule_detail.lower()}. Always check packaging directly if uncertain.",
                "ai_used": False
            }

    # Fallback explanation when no API key is provided
    return {
        "explanation": f"[AI] Nutrilens flagged '{payload.allergen}' because {payload.rule_detail.lower()}. Always check packaging directly if uncertain.",
        "ai_used": False
    }
