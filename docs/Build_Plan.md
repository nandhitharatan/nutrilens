Nutrilens v1 Build Plan

Look Beyond the Label. Nine phases, built in order so the riskiest part (label photo with highlights) lands early.

Phase 1: Setup

Monorepo with /web (Next.js 14, TypeScript, Tailwind) and /api (FastAPI).

Install the deps from the Tech Stack doc. Add the Tailwind design tokens (Parchment, Oxblood, Ink, Gold) and fonts.

Create the Supabase, Google Cloud Vision and Google Gemini projects.

Add .env.example files with names only. Add .env to .gitignore.

Add a /health endpoint and deploy hello-world to Vercel and Render early.

Phase 2: Database

Run nutrilens_schema.sql as a migration (profiles, scans, scan_boxes, findings, protein_log, vegan_ingredients).

Seed vegan_ingredients with about 50 common ingredients, including tricky ones like gelatin, casein, shellac and E120.

Seed two test users: a vegan with a peanut allergy, and a gym user with a protein goal.

Test RLS by reading user A's rows as user B. It must fail.

Phase 3: Auth

Supabase signup, email verify, login, Google sign-in, logout, forgot-password.

Next.js middleware for protected routes and session refresh.

FastAPI JWT check (PyJWT) as a dependency on every endpoint.

Three-step onboarding that saves to profiles and resumes at onboarding_step.

Profile page for editing everything.

Phase 4: Core Feature 1, Scan and Review

/scan page with camera capture, drag-and-drop and client-side compression.

POST /scan: blur and size check (OpenCV, Pillow), upload to Storage, Cloud Vision OCR, save lines to scan_boxes as 0 to 1 fractions.

/scan/review page: photo with OCR boxes, low-confidence lines flagged, inline edit.

POST /scan/{id}/confirm to save corrections.

Error states: blurry, no text, offline.

Phase 5: Core Feature 2, Analyze, Highlight and Results

Google Gemini structuring: send line ids, get back ids per field, "unknown" by default. Validate that every returned id exists.

Rule engine in pure Python, test-first with pytest: allergens, vegan / non-vegan / unknown, thresholds. Missing data always gives Unknown.

POST /analyze writes findings and scans.overall_status.

/results/:id page: overall status, SVG highlight layer with connector lines, mobile bottom sheet and desktop side callouts, per serving and per 100 g view with estimates marked, vegan check list.

POST /explain with a cached Haiku explanation and an "AI" tag.

Phase 6: Core Feature 3, Protein Tracker

Protein goal in onboarding and profile (already in the schema).

Protein card on Results: 1 serving, 2 servings or custom grams, then show grams, % of goal and grams left. Mark "Estimate" if serving or protein value is unclear.

POST /protein/log for "Add to today".

Dashboard progress bar that sums today's protein_log.

Phase 7: UI Polish

Dashboard with the empty states from the App Flow doc.

Loading skeletons for OCR and analysis (up to 15 s).

All error states from the doc, each with a clear next step.

Bottom tabs, desktop navbar, 404 page, reduced-motion support.

Keyboard focus rings on the SVG boxes.

Phase 8: Testing

Test with 20 or more real label photos: glossy, curved, angled, dark, partly covered.

Check the rule engine's missing-data cases. No No known conflict may appear when data is missing.

Run axe-core and keyboard-only checks on Results.

Check boxes stay aligned on a small phone, a tablet and a wide desktop.

Check the daily scan limit and repeat the RLS cross-user test.

Phase 9: Deploy

Set prod env vars in Vercel and Render. Secret ones stay backend-only.

Set CORS ALLOWED_ORIGINS, Google OAuth redirect URLs and the Supabase site URL.

Move off Render's free tier or add a keep-alive ping, since cold starts hurt the 15 s target.

Add Resend if Supabase email limits bite.

Final smoke test on a real phone from the prod URL.

Done Criteria

A new user can sign up, verify, onboard, scan a label, review it and get a result with highlights, end-to-end on a phone.

Every flag shows its source text. No missing-data case is ever labelled safe.

The protein card and Dashboard tally work.

Photo to results takes under 15 s on a clear photo.

RLS is verified, and no secrets are in the repo or frontend bundle.

Prod is live on the deployed URLs.

v2 (not in this build)

History, Compare, Ask Your Label, browser extension, caregiver alerts.