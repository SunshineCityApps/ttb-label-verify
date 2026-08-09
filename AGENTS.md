<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# TTB Label Verification Prototype — Project Spec

AI-powered alcohol label verification app. Take-home project for a US Treasury (TTB) AI role. Standalone proof-of-concept — NOT integrated with COLA or any government system.

## What it does

An agent uploads a label image plus the application data (the fields the producer submitted). The app uses AI vision to read the label, then verifies each field on the label matches the application. Per-field pass/fail with an overall verdict.

## Core design principles (do not violate)

1. **AI extracts, code verifies.** Claude vision extracts text/fields from the label image and returns structured JSON. All matching/verification logic is deterministic TypeScript — never ask the LLM "does this match?" This makes results explainable and consistent, which matters for a compliance tool.
2. **Speed is a hard requirement.** Target < 5 seconds per label end-to-end. A previous vendor pilot failed because 30-40s processing made agents revert to manual review. Use a fast Claude model (claude-haiku or claude-sonnet class), stream/show progress immediately, render per-field results as soon as available.
3. **Three-state matching, not binary.** Each field resolves to:
   - ✅ MATCH — exact or normalized match
   - ⚠️ MATCH WITH NOTE — same content, formatting differs (e.g., label says "STONE'S THROW", application says "Stone's Throw"). Show what differed. Agent makes the call.
   - ❌ MISMATCH — content differs (wrong ABV, missing field, etc.)
   This mirrors how experienced agents apply judgment instead of rejecting trivial case differences.
4. **Government warning is the exception — it must be EXACT.** The Government Health Warning Statement must match the statutory text word-for-word, and "GOVERNMENT WARNING:" must be in ALL CAPS. No fuzzy matching here. Deterministic comparison against the canonical text:

   > GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

   Check: (a) full text present word-for-word, (b) "GOVERNMENT WARNING:" is all caps. Flag title-case ("Government Warning") as a violation. Bold/font-size cannot be reliably verified from an image — note this as a documented limitation, but flag it for agent review. One OCR-noise carve-out (validated by e2e testing on the skewed label): when wording and capitalization match exactly and only punctuation differs, return ⚠️ "confirm punctuation visually" instead of ❌ — OCR cannot reliably read punctuation on imperfect photos, and a false rejection on a good label is the failure mode that makes agents abandon the tool.
5. **Stateless. No database, no stored images.** Prototype handles no PII and retains nothing — process in memory, return results, done. This is deliberate (federal data-retention posture), call it out in the README.
6. **UI must pass the "73-year-old test."** Half the user base is 50+, mixed tech comfort. One obvious flow: upload → verify → results. Big buttons, big readable results, clear color coding (green/yellow/red), zero hidden menus or hunting. No jargon.

## Fields to verify

- Brand name (normalized match: case-insensitive, trim whitespace, normalize apostrophes/quotes)
- Class/type designation (normalized match)
- Alcohol content / ABV (parse numbers — "45% Alc./Vol. (90 Proof)" should match application value "45%"; verify proof = 2× ABV when present)
- Net contents (normalize units — "750 mL" vs "750ml" vs "750 ML" all match)
- Government warning (EXACT match per principle 4)
- If a field can't be found on the label → ❌ with "not found on label"
- If image is unreadable/too poor quality → clear error telling the agent to request a better image (don't guess)

## Features

### 1. Single label verification (build first, end-to-end)
- Upload label image (drag-drop + file picker; accept jpg/png/webp)
- Form for application data (pre-fill button with the OLD TOM DISTILLERY sample for easy demo)
- Verify button → streaming/progressive results → per-field results card + overall verdict
- Show the extracted label text alongside results so the agent can eyeball-confirm

### 2. Batch upload (build second)
- Upload many labels at once (importers dump 200-300 applications at peak)
- For the prototype: CSV of application data + multiple images, matched by filename
- Queue with visible progress, results table, click into any row for the per-field detail
- Process with limited concurrency (e.g., 4-5 parallel) to keep total time reasonable

### 3. Imperfect image handling (document, don't over-build)
- Claude vision natively tolerates angles/glare/lighting reasonably well — include a skewed test image and show it works
- If confidence is low or text unreadable, fail loudly with "request better image" rather than guessing

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Anthropic Claude API (vision) — key in `.env.local` as `ANTHROPIC_API_KEY`, called server-side only (API route), never exposed client-side
- Tailwind for styling
- No database, no auth (prototype scope)
- Test labels in `/test-labels` with a manifest of expected results

## API design

- `POST /api/verify` — accepts image + application fields, returns structured verification result
- Claude call: single vision request returning strict JSON `{ brand_name, class_type, alcohol_content, net_contents, government_warning_text, ... }` with instruction to return null for fields not visible — then verification runs in code
- Handle Claude API errors gracefully (timeout, rate limit) with a human-readable retry message

## Test labels (create before building UI)

Minimum set in `/test-labels`:
1. Clean pass — OLD TOM DISTILLERY sample, everything correct
2. Case mismatch — brand "STONE'S THROW" on label, "Stone's Throw" in application → expect ⚠️
3. Warning violation — "Government Warning" in title case → expect ❌ on warning
4. ABV mismatch — label says 40%, application says 45% → expect ❌
5. Missing field — no net contents on label → expect ❌ "not found"
6. Skewed/angled photo of the clean label → expect ✅ (demonstrates imperfect-image handling)

## README must include

- Setup + run instructions (local + deployed URL)
- Approach and architecture (AI extracts / code verifies — explain why)
- **Requirements traceability**: map each feature to the stakeholder who asked for it (5s target → Sarah's failed pilot; exact warning check → Jenny; three-state matching → Dave's STONE'S THROW example; batch → Sarah/Janet; simple UI → Sarah's mother benchmark)
- Assumptions and trade-offs
- Production notes: real deployment would need FedRAMP-authorized model endpoints (e.g., Claude via AWS GovCloud/Bedrock) given agency firewall restrictions on outbound ML endpoints, plus records-retention and PII review

## Build order

1. Scaffold Next.js + Tailwind, deploy empty shell to Vercel (confirm pipeline works day one)
2. Single-label flow end-to-end (upload → extract → verify → results)
3. Verification module with unit tests (normalization, ABV parsing, warning exact-match)
4. Batch upload
5. UI polish for the 73-year-old test
6. README + requirements traceability

Working core + clean code beats ambitious + incomplete. If time runs short, cut batch before cutting polish on the single-label flow.
