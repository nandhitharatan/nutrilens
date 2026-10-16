# Nutrilens: Look Beyond the Label

Nutrilens is a responsive web application that inspects packaged-food label photos and cross-references extracted ingredients and allergens against a user's dietary profile.

## Key Principles & Guarantees
1. **Unknown is never safe:** Missing, unreadable, or low-confidence data is strictly evaluated as **Unknown**, never safe.
2. **Every flag shows exact proof:** Findings link to real OCR bounding boxes with fractional coordinates `(x, y, w, h)` on the packaging photo, tagged `confirmed`, `uncertain`, or `user_confirmed`.
3. **No invented label information:** Google Gemini only structures OCR line IDs (`ingredient`, `allergen`, `nutrition`, `serving_size`, `product_name`). The backend validates and strictly rejects any ID that was not in the original OCR output.
4. **Pure Python safety engine:** All allergen evaluations, edge cut-off checks, and overall safety determinations run deterministically in Python via `label_safety.py`. AI text is used solely for optional explanations tagged `[AI]`.
5. **Human in the loop:** Users can correct OCR mistakes on `/scan/review` and re-run rules instantly.
6. **Design tokens:** Light mode only, styled with Parchment (`#F1EDE4`), Oxblood (`#A23B32`), Ink (`#26231F`), and Gold (`#E3B95B`). No green or purple is used anywhere.

---

## Project Structure
```
missionathon/
├── api/
│   ├── app/
│   │   ├── label_safety.py     # Core quality checks & safety rule engine
│   │   ├── db.py               # Database layer (SQLite & Supabase support)
│   │   ├── ocr.py              # Google Cloud Vision & local Tesseract OCR
│   │   ├── structuring.py      # Google Gemini field structuring with strict ID validation
│   │   └── main.py             # FastAPI endpoints (/scan, /confirm, /analyze, /explain)
│   └── tests/
│       ├── test_label_safety.py # Original 12 core safety tests
│       └── test_api.py          # API tests (retake, confirm, analyze, edge, missing data)
├── web/                         # Next.js 14 App Router, TypeScript, Tailwind
│   ├── app/
│   │   ├── page.tsx            # Landing page with signature demo
│   │   ├── scan/page.tsx       # Photo capture, camera input, blur checks
│   │   ├── scan/review/page.tsx# Real photo SVG overlay & inline text editor
│   │   ├── results/[id]/page.tsx# Overall status, SVG callouts, evidence badges
│   │   └── profile/page.tsx    # Dietary preferences & protein targets
│   └── tailwind.config.ts      # Parchment, Oxblood, Ink, Gold design tokens
├── db/
│   └── nutrilens_schema.sql    # PostgreSQL / Supabase schema
├── docs/                       # Product requirements, tech stack, and app flow
└── LIMITATIONS.md              # Documented limitations & verification
```

---

## Running the Application

### 1. Start the FastAPI Backend
```bash
# From the project root
uvicorn api.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API documentation is available at `http://localhost:8000/docs`.

### 2. Start the Next.js Frontend
```bash
# Navigate to web directory
cd web
npm run dev
```
Open `http://localhost:3000` in your desktop or mobile browser.

---

## Running the Tests
To execute all 23 backend and rule engine tests:
```bash
python -m pytest api/tests
```

All 23 tests pass:
- Quality and blur detection (`check_image`)
- Missing OCR output evaluates to `Unknown`, never safe
- Edge cut-off detection (`touches_edge` triggers manual confirmation)
- User corrections updating lines to `user_confirmed` and re-analyzing status
- Google Gemini structuring strictly rejecting invented or non-existent line IDs
- AI explanation tags (`[AI]`)
