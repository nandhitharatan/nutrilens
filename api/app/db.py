import os
import uuid
import sqlite3
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

# Database layer supporting Supabase or local SQLite
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

class DBStore:
    def __init__(self, db_path: str = "nutrilens.db"):
        self.db_path = db_path
        self._init_sqlite()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        with self._get_conn() as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                image_path TEXT,
                status TEXT NOT NULL DEFAULT 'uploaded',
                overall_status TEXT,
                product_name TEXT,
                serving_size_g REAL,
                serving_is_estimate INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS scan_boxes (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                line_no INTEGER NOT NULL,
                text TEXT NOT NULL,
                ocr_confidence REAL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                w REAL NOT NULL,
                h REAL NOT NULL,
                field TEXT,
                source TEXT NOT NULL DEFAULT 'detected',
                user_corrected INTEGER NOT NULL DEFAULT 0,
                corrected_text TEXT,
                UNIQUE(scan_id, line_no),
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            );
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS findings (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                result TEXT NOT NULL,
                title TEXT NOT NULL,
                rule_detail TEXT NOT NULL,
                box_ids TEXT NOT NULL,
                ai_explanation TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
            );
            """)
            conn.commit()

    def create_scan(self, scan_id: Optional[str] = None, image_path: Optional[str] = None, user_id: str = "00000000-0000-0000-0000-000000000001", status: str = "uploaded") -> Dict[str, Any]:
        scan_id = scan_id or str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO scans (id, user_id, image_path, status, created_at) VALUES (?, ?, ?, ?, ?)",
                (scan_id, user_id, image_path, status, created_at)
            )
            conn.commit()
        return self.get_scan(scan_id)

    def get_scan(self, scan_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,))
            row = cur.fetchone()
            if not row:
                return None
            return dict(row)

    def update_scan(self, scan_id: str, **kwargs) -> Optional[Dict[str, Any]]:
        fields = []
        vals = []
        for k, v in kwargs.items():
            fields.append(f"{k} = ?")
            vals.append(v)
        vals.append(scan_id)
        with self._get_conn() as conn:
            conn.execute(f"UPDATE scans SET {', '.join(fields)} WHERE id = ?", vals)
            conn.commit()
        return self.get_scan(scan_id)

    def save_boxes(self, scan_id: str, boxes: List[Dict[str, Any]], user_id: str = "00000000-0000-0000-0000-000000000001") -> List[Dict[str, Any]]:
        saved = []
        with self._get_conn() as conn:
            for b in boxes:
                box_id = b.get("id") or str(uuid.uuid4())
                conn.execute("""
                    INSERT OR REPLACE INTO scan_boxes 
                    (id, scan_id, user_id, line_no, text, ocr_confidence, x, y, w, h, field, source, user_corrected, corrected_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    box_id,
                    scan_id,
                    user_id,
                    b["line_no"],
                    b["text"],
                    b.get("ocr_confidence", 0.95),
                    b["x"],
                    b["y"],
                    b["w"],
                    b["h"],
                    b.get("field"),
                    b.get("source", "detected"),
                    1 if b.get("user_corrected") else 0,
                    b.get("corrected_text")
                ))
            conn.commit()
        return self.get_boxes(scan_id)

    def get_boxes(self, scan_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM scan_boxes WHERE scan_id = ? ORDER BY line_no ASC", (scan_id,))
            rows = cur.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["user_corrected"] = bool(d["user_corrected"])
                result.append(d)
            return result

    def update_box_correction(self, scan_id: str, line_no: int, corrected_text: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE scan_boxes 
                SET corrected_text = ?, user_corrected = 1 
                WHERE scan_id = ? AND line_no = ?
            """, (corrected_text, scan_id, line_no))
            conn.commit()
            cur = conn.execute("SELECT * FROM scan_boxes WHERE scan_id = ? AND line_no = ?", (scan_id, line_no))
            r = cur.fetchone()
            if not r:
                return None
            d = dict(r)
            d["user_corrected"] = bool(d["user_corrected"])
            return d

    def save_findings(self, scan_id: str, findings: List[Dict[str, Any]], user_id: str = "00000000-0000-0000-0000-000000000001"):
        import json
        created_at = datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            conn.execute("DELETE FROM findings WHERE scan_id = ?", (scan_id,))
            for f in findings:
                finding_id = f.get("id") or str(uuid.uuid4())
                box_ids_str = json.dumps(f.get("box_ids", []))
                conn.execute("""
                    INSERT INTO findings (id, scan_id, user_id, rule_type, result, title, rule_detail, box_ids, ai_explanation, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    finding_id,
                    scan_id,
                    user_id,
                    f.get("rule_type", "allergen"),
                    f["result"],
                    f["title"],
                    f["rule_detail"],
                    box_ids_str,
                    f.get("ai_explanation"),
                    created_at
                ))
            conn.commit()

    def get_findings(self, scan_id: str) -> List[Dict[str, Any]]:
        import json
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM findings WHERE scan_id = ? ORDER BY created_at ASC", (scan_id,))
            rows = cur.fetchall()
            out = []
            for r in rows:
                d = dict(r)
                try:
                    d["box_ids"] = json.loads(d["box_ids"])
                except Exception:
                    d["box_ids"] = []
                out.append(d)
            return out

    def get_finding(self, finding_id: str) -> Optional[Dict[str, Any]]:
        import json
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM findings WHERE id = ?", (finding_id,))
            row = cur.fetchone()
            if not row:
                return None
            d = dict(row)
            try:
                d["box_ids"] = json.loads(d["box_ids"])
            except Exception:
                d["box_ids"] = []
            return d

    def update_finding_explanation(self, finding_id: str, ai_explanation: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            conn.execute("UPDATE findings SET ai_explanation = ? WHERE id = ?", (ai_explanation, finding_id))
            conn.commit()
        return self.get_finding(finding_id)

db = DBStore()
