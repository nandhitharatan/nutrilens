import os
import io
import json
import shutil
from typing import List, Dict, Any, Tuple
from PIL import Image

try:
    import pytesseract
    from pytesseract import Output
    tess_path = shutil.which("tesseract")
    if not tess_path:
        for fallback_path in [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
        ]:
            if os.path.exists(fallback_path):
                tess_path = fallback_path
                break
    if tess_path:
        pytesseract.pytesseract.tesseract_cmd = tess_path
except Exception:
    pytesseract = None

OCR_MIN_CONF = float(os.getenv("OCR_MIN_CONFIDENCE", "0.80"))

def run_ocr(img_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Runs OCR on the given image bytes.
    First tries Google Cloud Vision if credentials exist.
    Otherwise uses Tesseract OCR as the local fallback.
    Returns list of dicts:
    [
        {
            "line_no": int,
            "text": str,
            "ocr_confidence": float (0.0 to 1.0),
            "x": float (0.0 to 1.0),
            "y": float (0.0 to 1.0),
            "w": float (0.0 to 1.0),
            "h": float (0.0 to 1.0),
        }
    ]
    """
    # 1. Try Google Cloud Vision
    gcp_creds = os.getenv("GOOGLE_CREDENTIALS_JSON") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if gcp_creds:
        try:
            from google.cloud import vision
            client = vision.ImageAnnotatorClient()
            image = vision.Image(content=img_bytes)
            response = client.document_text_detection(image=image)
            
            # Get image dimensions from PIL
            pil_img = Image.open(io.BytesIO(img_bytes))
            img_w, img_h = pil_img.size

            lines = []
            line_no = 1
            for page in response.full_text_annotation.pages:
                for block in page.blocks:
                    for paragraph in block.paragraphs:
                        para_words = []
                        conf_sum = 0.0
                        word_count = 0
                        min_x, min_y = 1.0, 1.0
                        max_x, max_y = 0.0, 0.0

                        for word in paragraph.words:
                            word_text = "".join([s.text for s in word.symbols])
                            para_words.append(word_text)
                            conf_sum += getattr(word, 'confidence', 0.9)
                            word_count += 1
                            for v in word.bounding_box.vertices:
                                vx = max(0.0, min(1.0, (v.x or 0) / img_w))
                                vy = max(0.0, min(1.0, (v.y or 0) / img_h))
                                min_x = min(min_x, vx)
                                min_y = min(min_y, vy)
                                max_x = max(max_x, vx)
                                max_y = max(max_y, vy)

                        if para_words:
                            text = " ".join(para_words).strip()
                            avg_conf = (conf_sum / word_count) if word_count > 0 else 0.85
                            lines.append({
                                "line_no": line_no,
                                "text": text,
                                "ocr_confidence": round(avg_conf, 3),
                                "x": round(min_x, 4),
                                "y": round(min_y, 4),
                                "w": round(max(0.01, max_x - min_x), 4),
                                "h": round(max(0.01, max_y - min_y), 4),
                            })
                            line_no += 1
            if lines:
                return lines
        except Exception as e:
            # Fall back to local OCR
            pass

    # 2. Local fallback: Tesseract OCR
    pil_img = Image.open(io.BytesIO(img_bytes))
    img_w, img_h = pil_img.size
    
    if pytesseract is not None:
        try:
            data = pytesseract.image_to_data(pil_img, output_type=Output.DICT)
            # Group by block_num, par_num, line_num
            line_groups: Dict[Tuple[int, int, int], List[int]] = {}
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                text = data['text'][i].strip()
                if not text:
                    continue
                key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
                if key not in line_groups:
                    line_groups[key] = []
                line_groups[key].append(i)

            lines = []
            line_no = 1
            for key, indices in line_groups.items():
                words = [data['text'][idx].strip() for idx in indices if data['text'][idx].strip()]
                if not words:
                    continue
                line_text = " ".join(words)
                confs = [float(data['conf'][idx]) for idx in indices if float(data['conf'][idx]) >= 0]
                avg_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.70

                min_x = min(data['left'][idx] for idx in indices)
                min_y = min(data['top'][idx] for idx in indices)
                max_x = max(data['left'][idx] + data['width'][idx] for idx in indices)
                max_y = max(data['top'][idx] + data['height'][idx] for idx in indices)

                lines.append({
                    "line_no": line_no,
                    "text": line_text,
                    "ocr_confidence": round(avg_conf, 3),
                    "x": round(max(0.0, min_x / img_w), 4),
                    "y": round(max(0.0, min_y / img_h), 4),
                    "w": round(max(0.01, (max_x - min_x) / img_w), 4),
                    "h": round(max(0.01, (max_y - min_y) / img_h), 4),
                })
                line_no += 1
            if lines:
                return lines
        except Exception:
            pass

    # 3. If no OCR engine produced lines, return empty list
    return []
