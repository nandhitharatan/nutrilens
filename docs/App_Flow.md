Nutrilens: App Flow

Oct 16, 2026 · @nandhitha

Every choice below is a decision, not a menu: mobile-first, bottom tabs, scan-first home screen, and a three-step onboarding that feeds the personalization from the PRD.

1. Pages List

Version 1 has 10 pages. History, compare, chat and the browser extension wait for v2, as in the PRD.

Page

Route

What it does

Version

Landing

/

Explains Nutrilens and pushes sign-up

v1

Sign up

/signup

Create account with email and password

v1

Login

/login

Log in, with a forgot-password link

v1

Verify email

/verify-email

Waits for the email link, with a resend button

v1

Onboarding

/onboarding

Three-step personalization (see section 4)

v1

Dashboard

/dashboard

Home: scan button, recent scans, today's protein progress

v1

Scan

/scan

Capture or upload a label photo

v1

Review extracted data

/scan/review

User checks and fixes what the app read

v1

Results

/results/:id

Flags with evidence, serving-size view, vegan check, protein coverage

v1

Profile and settings

/profile

Edit personalization, account, log out

v1

Scan history

/history

Past scans and label changes

v1

Compare

/compare

Side-by-side products

v1

Ask Your Label

/results/:id/chat

Chatbot grounded in the scanned label

v1

2. Navigation Type

Decision: bottom tabs on mobile, top navbar on desktop.

Why: people use Nutrilens while holding a product in a shop, so one-thumb navigation matters most.

Tabs in v1: Home, Scan (big centre button), Profile.History.

Landing, login, sign-up, verify and onboarding show no tabs. The tabs appear only after onboarding.

3. First Screen

Decision: a landing page with a sample result, not a blank login form.

Tagline at the top: "Look Beyond the Label".

One picture of a sample scan with a flagged ingredient highlighted, so a new visitor sees the value in 5 seconds.

Three short lines: Scan a label, See what matters to you, Know what's unclear.

Two buttons: Get started (to sign up) and Log in.

Why no scanning before sign-up: results depend on the user's profile, so an anonymous scan would be generic and less useful.

4. Auth Flow

Signup → Email verify → Onboarding → Dashboard

Sign up: email and password.

Verify email: user taps the link in the email. The page offers Resend, and the link expires after 24 hours.

Onboarding has three short steps with a progress bar and a Skip option where noted:

About you: age (required, because thresholds depend on it).

Health and diet: dietary conditions, allergies and diet type such as vegan (all skippable, with a "Prefer not to say" option).

Fitness: "Do you go to the gym?" If yes, enter a daily protein goal in grams.

Dashboard: lands here with a prompt to scan the first label.

Privacy rules for onboarding:

Ask only what the app uses to flag or personalize results.

Show one line under the health step: "Used only to flag labels for you. Nutrilens is not medical advice."

Everything can be edited later in /profile.

Returning user: Login → Dashboard. An unfinished onboarding resumes at the step the user left.

5. Core User Journey 1: Check a product label

Goal: I'm in a shop and want to know if this product is OK for me.

Open the app and land on the Dashboard.

Tap the big Scan button.

Take a photo of the label. A guide frame and a tip like "Hold steady, avoid glare" help the photo.

The Review page shows what the app read: ingredients, nutrition and allergens. Unclear fields are marked, and the user can fix them.

Tap Analyze.

The Results page shows, in this order:

Overall status: No known conflict, Conflict found or Unknown.

Flagged items, each with the exact label text highlighted as proof.

Nutrition per serving and per 100 g, estimates clearly marked.

Vegan check: vegan, non-vegan or unknown per ingredient.

Tap Done to return to the Dashboard. In v2 the scan is also saved to History.

6. Core User Journey 2: Protein goal check (gym users)

Goal: I want to know how much of my daily protein this product gives me.

Scan the label (steps 1 to 5 of Journey 1).

On Results, a Protein card appears at the top because a protein goal is set.

The card asks: "How much will you eat?" with quick choices (1 serving, 2 servings, or a custom amount in grams).

The card then shows three numbers:

Protein in that amount.

Percentage of the daily goal covered.

Grams still left for the day.

If the serving size or protein value is unclear, the card says Estimate and explains why.

Optional: tap Add to today so the Dashboard progress bar updates.

Decision: the daily total resets at midnight and is a simple running tally. Meal planning is out of scope.

7. Empty States

Where

What shows

Button

Dashboard, no scans yet

Illustration and "Scan your first label"

Scan now

Dashboard, no protein goal set

Small card: "Going to the gym? Set a protein goal"

Set goal

Dashboard, protein goal set, nothing added today

Empty progress bar: "0 g of your goal"

Scan a product

Results, field not found on label

"Not found on label", counted as Unknown, never as safe

Add manually

History (v2), no scans

"Your scans will appear here"

Scan now

8. Error States

Rule for every error: say what happened in plain words, give one clear next step, and never lose the user's work.

Problem

What the user sees

Where they go

Blurry or dark photo

"We couldn't read this clearly" with tips

Back to Scan to retake

No text found in photo

"This doesn't look like a label"

Back to Scan

Part of the label unreadable

Results still load, unreadable fields shown as Unknown

Review page to fix manually

No internet

"You're offline" banner, photo kept on the device

Auto-retry when back online, or Retry

Analysis fails on our side

"Something went wrong on our end"

Retry, scan stays on screen

Verification link expired

"This link has expired"

Resend email

Wrong password

"Email or password is incorrect"

Stay on /login, with Forgot password

Session expired

"Please log in again"

/login, then back to the page they were on

Page not found (404)

"We couldn't find that page"

Go to Dashboard