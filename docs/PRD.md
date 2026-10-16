Nutrilens: Product Requirements Document

Tagline: Look Beyond the Label

1. Problem

What's the pain?

Food labels are packed with ingredient lists, nutrition numbers, allergen warnings and tiny print.

Serving sizes differ between brands, so numbers can't be compared at a glance.

Missing or unclear information is easy to mistake for "safe".

Who feels it?

Shoppers who want to eat clean but get confused between different nutrition labels.

Students living independently, caregivers, and people with allergies or dietary rules (for example vegan).

What we're building: An app that takes a photo of a packaged-food label, pulls out the information, and explains matches or conflicts with the user's own dietary profile. It always separates what is visible on the label from what is uncertain, missing or unreadable.

2. Core Value Proposition

Shows its proof: every flag is tied to the exact text on the label.

Honest about gaps: unknown never means safe.

Personal: results follow the user's own preferences and limits.

Real-life numbers: values are converted to what the user actually eats.

3. Target User

Primary persona: "Clean-eating Chitra"

A student or young shopper who wants to eat healthier but feels lost between different nutrition labels.

She checks products in a hurry, in the store or at home, and wants a clear answer with reasons instead of raw numbers.

Also serves: caregivers shopping for someone else, and people with allergies or vegan diets.

4. Core Features (Must Have)

User profile setup: choose dietary preferences, allergens to avoid and nutrition thresholds (sugar, sodium and so on). Gym users can also set a daily protein goal.

Smart Label Scanner and Highlights: upload or capture a label photo, extract product name, ingredients, nutrition facts, allergens and warnings, and highlight the exact source text.

Data validation: normalize units, catch OCR errors, and mark fields as clear, ambiguous or missing.

Unknown-Is-Not-Safe Engine: every result is one of No known conflict, Conflict found or Unknown. Missing data never becomes "safe".

Personalized results dashboard: shows flagged ingredients, nutrition analysis and a reason for every flag.

Serving-Size Reality Check: compare per serving and per 100 g/ml, with estimates clearly marked as estimates.

Vegan and Ingredient-Origin Checker: classify ingredients as vegan, non-vegan or unknown, and ask for more evidence when the source is ambiguous.

Daily Protein Goal Tracker (for gym users): after a scan, the user enters how much they will eat. The app shows the protein in that amount, the percentage of their daily goal it covers, and the grams still left to reach the goal. If the protein value or serving size is unclear, the result is marked as an estimate.Similar Product Finder and Comparison: compare nutrition, ingredients, allergens, vegan status and price, and explain trade-offs instead of naming one "best".

Ask Your Label (AI chatbot): questions like "Why is this flagged?" answered only from the scanned label.Shopping Memory and Scan History: save scans, corrections and preferences.Shopping Browser Extension: compact warnings on supported grocery pages.Caregiver alerts: only if the user turns them on and sets them up.

5. Nice to Have (v2 / if time allows)

Label Change Radar: flag changes between two scans of the same product.

Ingredient Alias and Origin Graph: link alternate ingredient names to possible sources.

Evidence Passport: a shareable report with image, extracted values and unresolved questions.

Supplement and medicine labels: extend scanning beyond food.

6. Out of Scope (this version does NOT do)

Give medical advice, diagnose conditions or replace a doctor, dietitian or pharmacist.

Declare any product "safe" when data is missing or unreadable.

Handle supplements and medicine labels (planned for v2).

Run the browser extension or send caregiver notifications.

Scan barcodes or look up live prices across stores.

Guarantee 100% OCR accuracy on blurry, curved or damaged labels.

Support multiple languages on labels.

7. User Stories

As a shopper, I want to take a photo of a label so that I get the key facts without reading tiny print.

As a clean-eating user, I want my sugar, sodium and ingredient limits checked so that I know if a product fits my goals.

As a person with an allergy, I want allergens highlighted on the label so that I can see the exact text behind each warning.

As a vegan, I want ingredients marked vegan, non-vegan or unknown so that I don't miss hidden animal-derived items.

As a confused label reader, I want values shown per serving and per 100 g so that I can compare products fairly.

As a careful user, I want unreadable or missing fields clearly marked so that I never assume a product is safe.

As a caregiver, I want to check a label against someone else's profile so that I can shop for them confidently.

As a repeat shopper (v2), I want my past scans saved so that I can compare products and spot label changes.

As a gym-goer, I want to set my daily protein goal and enter how much I'll eat so that I can see how much of my goal a product covers.

8. Success Metrics

Onboarding: 100 sign-ups in the first week, with more than 80% completing their dietary profile.

Task completion: more than 80% of scans reach a results dashboard.

Extraction accuracy: at least 90% of ingredients and nutrition values extracted correctly on clear photos.

Trust: 100% of flags show their source text, and 0 missing-data cases are labelled "safe".

Speed: photo to results in under 15 seconds.

Usefulness: more than 70% of users say the result helped them decide (quick thumbs up or down).

Retention: 40% of users scan again within 7 days.

Protein tracker adoption: more than 50% of gym users who set a protein goal use it on at least one scan in their first week.