Nutrilens: Tech Stack

Oct 16, 2026 · @nandhitha

The stack is built around the signature feature: the real label photo with SVG highlights on top. Next.js and Tailwind carry the design system, Google Cloud Vision supplies text with exact coordinates, Google Gemini structures and explains, and a plain Python rule engine makes every safety decision.

1. Frontend

Decision: Next.js 14 (App Router) with TypeScript and Tailwind CSS, built as a PWA, light mode only.

Why Next.js: one codebase for the landing page, the app pages and the desktop layout.

Why a PWA: users add it to their phone home screen and open the camera from the browser, with no app-store build.

Design tokens in the Tailwind config: Parchment #F1EDE4, Oxblood #A23B32, Ink #26231F, Gold #E3B95B, an 8-point spacing scale and small corner radii (4 to 8 px). No dark mode, no green, no purple.

Fonts: Space Grotesk (headings), DM Sans (body and UI) and IBM Plex Mono (technical notes), loaded with next/font so they are self-hosted and don't flash.

Label highlighting: an SVG layer sits on top of the uploaded image. Boxes are stored as fractions from 0 to 1, so they stay aligned when the image resizes. Connector lines to the callouts are drawn in the same SVG.

Mobile explanations: a bottom sheet (shadcn/ui Drawer, built on Vaul). On desktop the callouts sit beside the image.

Accessibility: shadcn/ui on Radix primitives for keyboard and focus handling. Every box is a focusable SVG element with an aria-label and a visible 2 px oxblood focus ring.

Motion: Motion (Framer Motion) for the fade-and-rise entrances and box reveals, switched off when the user prefers reduced motion.

Camera and upload: a file input with capture="environment" for the camera, plus drag-and-drop on desktop.

2. Backend

Decision: FastAPI (Python), split into three separate layers: OCR, rule engine and AI explanations.

Why separate layers: the brief says rule-based checks must stay apart from AI text, and this makes that true in the code.

The layers:

OCR: Google Cloud Vision reads the photo and returns each line with its box and confidence.

Structuring: Google Gemini gets the OCR lines (each with an id) and returns which ids are ingredients, allergens, sugar, sodium, protein and serving size. It returns ids only, never coordinates, so every box comes from the OCR engine.

Rule engine: plain Python with no AI. It decides No known conflict, Conflict found or Unknown.

Explanations: Google Gemini writes a plain-language explanation from the extracted text and the rule result only, shown with an "AI" tag.

Main endpoints in v1:

POST /scan: checks the photo (blur, size), runs OCR, returns lines with boxes and confidence.

POST /scan/{id}/confirm: saves the user's corrected text.

POST /analyze: structures the fields, runs the rules, saves the findings.

POST /explain: returns the AI explanation for one finding, called when the user taps it.

POST /protein/log: adds a product's protein to today's tally.

Simple CRUD (profile, thresholds, protein goal) goes straight from the frontend to Supabase, protected by Row Level Security.

3. Database

Decision: PostgreSQL via Supabase.

Tables in v1:

profiles: age, conditions, allergies, diet type, nutrition thresholds and protein goal.

scans: image path and status.

scan_boxes: detected text, OCR confidence, the box as 0 to 1 fractions (x, y, width, height), field type, source (detected, rule, ai or unknown) and whether the user corrected it.

findings: the rule result, the linked boxes and the status.

protein_log: daily protein entries.

vegan_ingredients: your own reference list of ingredients and their vegan status.

Row Level Security on every table, so a user can only read their own rows.

Label photos go in a private Supabase Storage bucket, and the user can delete them from their profile.

Allergies and health conditions are sensitive, so store only what the app uses and never expose them publicly.

4. Auth

Decision: Supabase Auth with email and password plus Google sign-in.

Email verification is on, which matches the sign-up flow in the App Flow doc.

Google sign-in is one extra button and removes password friction for students.

The frontend sends the Supabase login token to FastAPI, and FastAPI checks it before doing any work.

5. Hosting

Decision: Vercel for the frontend, Render for FastAPI, Supabase for database, auth and storage.

Vercel: free tier, deploys on every push to GitHub.

Render: free tier for FastAPI. OCR runs in Google Cloud Vision, so the backend stays light with no heavy local models. The free service still sleeps after inactivity, so move to a small paid plan before real users arrive.

Supabase: free tier is enough for a student project and early testing.

6. Third-Party APIs

Prices and limits change, so check each provider's pricing page before launch.

API

Purpose

Tier

Version

Google Cloud Vision (Document Text Detection)

OCR: text lines, boxes and confidence

Free monthly allowance, then paid per image

v1

Google Gemini (google-genai)

Structures OCR lines into fields and writes plain-language explanations

Paid, per use

v1

Google OAuth (through Supabase)

Google sign-in

Free

v1

Resend

Verification and password-reset emails, if Supabase's built-in email is too limited

Free tier, paid above it

v1

Open Food Facts

Product data for comparison and similar-product suggestions

Free, open data

v2

Decision on label reading: Google Cloud Vision for OCR, Google Gemini for structuring and explaining.

Why not Gemini alone: the brief needs precise bounding boxes, and a vision model's coordinates are not reliable enough. An OCR engine measures them.

Why not Tesseract: it is free, but weaker on curved, glossy and angled packaging. Keep it only as a free fallback for local development.

Gemini models: Gemini Flash (gemini-2.5-flash) for structuring and explanations to keep latency and costs low.

Prompt rules: return "unknown" for any field not found, and return only line ids that exist. The backend checks every id before using it.

Low confidence: lines under the confidence limit are marked uncertain and highlighted on the Review page for correction.

Cost control: compress the photo before upload, set a daily scan limit per user, and cache explanations.

7. Key Libraries

Frontend

TanStack React Query: fetching and caching scan data.

Zod: validates forms and API responses.

React Hook Form: onboarding and profile forms.

shadcn/ui (Radix) and Vaul: accessible components and the mobile bottom sheet.

Motion: fade-and-rise entrances and box reveals.

Lucide React: icons.

browser-image-compression: shrinks photos before upload.

Serwist (next-pwa): makes the app installable.

Playwright, Vitest and axe-core: end-to-end tests, unit tests and accessibility checks.

Backend

FastAPI and Uvicorn: the API server.

Pydantic: defines the label data shape and checks every field.

google-cloud-vision: OCR client.

google-genai (Python SDK): calls the Google Gemini API.

OpenCV (headless): blur detection, plus basic straightening and contrast fixes before OCR.

Pillow: image size and format checks.

supabase-py: talks to the database and storage.

PyJWT: verifies the Supabase login token.

pytest: tests for the allergen, vegan, protein and rule-engine logic.

8. Environment Variables

Names only, never values. Never commit them to GitHub, and keep the secret ones out of the frontend.

Variable

Lives in

Secret?

NEXT_PUBLIC_SUPABASE_URL

Frontend (Vercel)

No

NEXT_PUBLIC_SUPABASE_ANON_KEY

Frontend (Vercel)

No, protected by Row Level Security

NEXT_PUBLIC_API_URL

Frontend (Vercel)

No

GEMINI_API_KEY

Backend (Render)

Yes

GEMINI_MODEL

Backend (Render)

No (default: gemini-2.5-flash)

GOOGLE_CREDENTIALS_JSON

Backend (Render)

Yes, the Cloud Vision service account

SUPABASE_URL

Backend (Render)

No

SUPABASE_SERVICE_ROLE_KEY

Backend (Render)

Yes, never in the frontend

SUPABASE_JWT_SECRET

Backend (Render)

Yes

ALLOWED_ORIGINS

Backend (Render)

No, your frontend URL for CORS

OCR_MIN_CONFIDENCE

Backend (Render)

No, below this a line counts as uncertain

MAX_IMAGE_MB

Backend (Render)

No

DAILY_SCAN_LIMIT

Backend (Render)

No

RESEND_API_KEY

Supabase email settings or backend

Yes, only if Resend is used

Google OAuth client ID and secret are set inside the Supabase dashboard, so they are not app variables.

9. How the Signature Feature Works

Scan → Review → Highlight → Explain

Scan: the browser compresses the photo and sends it to POST /scan. The backend rejects blurry or tiny photos right away with a retake message.

Review: OCR lines come back with boxes and confidence. The user sees the real photo with the detected text and fixes any wrong or low-confidence line before analysis.

Highlight: POST /analyze structures the fields and runs the rules. The SVG layer draws a box around each relevant region and a connector line to its callout.

Explain: tapping a box or callout shows the exact detected text, the rule finding and, on request, the AI explanation. Each kind of information has its own label: detected fact, rule finding, AI explanation or uncertain.

Status: every product gets No known conflict, Conflict found or Unknown, and a missing or unreadable field always counts as Unknown.

10. Testing

Test with real packaged-food photos: blurry, angled, glossy, curved and partly covered labels.

Unit-test the rule engine with known cases, including every "missing data" case.

Run axe-core and keyboard-only checks on the results screen.

Check the annotation layout on a small phone, a tablet and a wide desktop to confirm boxes stay aligned and nothing scrolls sideways.