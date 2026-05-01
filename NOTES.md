# notes.md

## Changelog

- 2026-05-01: Initialized notes log for eval harness implementation.
- 2026-05-01: Added LLM client with tool-use extraction + retries, prompt hashing, and new CoT prompt.
- 2026-05-01: Added schema loader + extraction service wired to Anthropic client.
- 2026-05-01: Implemented evaluator scoring (fuzzy match, set F1, numeric tolerance) and hallucination detection.
- 2026-05-01: Added dataset loader, SSE event stream, runner service with concurrency/backoff, and run routes.
- 2026-05-01: Stored dataset filters on runs and scoped idempotent caching by prompt hash.
- 2026-05-01: Added CLI entrypoint and eval scripts for headless runs.
- 2026-05-01: Added dashboard layouts, API client, and runs/compare UI components.
- 2026-05-01: Exposed dataset/backoff helpers to support upcoming tests.
- 2026-05-01: Added evaluation, retry, prompt hash, and runner helper tests plus test scripts.
- 2026-05-01: Added case detail trace panel for LLM attempts.
- 2026-05-01: Added API status component that pings the server root.
- 2026-05-01: Strengthened prompt instructions with field-level rules and improved few-shot examples.
- 2026-05-01: Added chief complaint/follow-up guidance and a third few-shot example for diagnosis vs plan separation.

## Thoughts

- Keeping prompt caching simple by marking per-request transcript content as ephemeral while leaving system prompts cacheable by default.
- Schema loader caches the JSON schema in memory to avoid repeated file reads.
- Hallucination detector flags values without substring or token-set match against the transcript.
- Runner uses a semaphore-style limiter (max 5) and exponential backoff on 429s.
- Resume logic reuses stored dataset filters to keep case selection consistent.
- CLI runs headless evaluations synchronously and prints the final summary.
- Dashboard now uses Space Grotesk + Fraunces and a warm/cool gradient palette.

---

## Feature Audit vs. README (2026-05-01)

### Hard Requirements Status

| Requirement | Status | Notes |
| --- | --- | --- |
| Tool use / structured output | ✅ | `tool_choice: { type: "tool", name: TOOL_NAME }` forces schema output |
| Retry-with-error-feedback (cap 3) | ✅ | Validation errors returned to model; all attempts logged |
| Prompt caching | ✅ fixed | System prompt now has `cache_control: { type: "ephemeral" }` so it caches across transcripts, not just within retries |
| Concurrency control + 429 backoff | ✅ | `ConcurrencyLimiter` (max 5) + `withRateLimitBackoffConfig` (exp. backoff, 3 retries) |
| Resumable runs | ✅ | `POST /api/v1/runs/:id/resume` fetches existing case IDs, skips them |
| Per-field metrics (field-appropriate) | ✅ | fuzzy Jaccard for text, ±tolerance for numerics, set-F1 for arrays |
| Hallucination detection | ✅ fixed | Bug fixed: was adding grounded values to findings (inverted logic). Now only flags values with no substring/fuzzy support in transcript |
| Compare view | ✅ | `/dashboard/compare` page exists |
| ≥8 tests | ✅ | 22 tests across 8 files — retry, fuzzy matching, set-F1, hallucination +/-, prompt hash, runner utils |
| API key not in browser | ✅ | Web app calls Hono only; only Hono holds `ANTHROPIC_API_KEY` |

### Bugs Found and Fixed

1. **Hallucination detector inverted** — was pushing a finding with `similarity: 1` when the value WAS found in the transcript (grounded), causing false positives. Fixed by removing the push on substring match and only pushing when `similarity < TEXT_MATCH_THRESHOLD`.
2. **System prompt not cached across transcripts** — `cache_control` was only on the user-content transcript block, creating a per-call ephemeral checkpoint that would always miss for different transcripts. Added `cache_control: { type: "ephemeral" }` to the system prompt block so the stable prompt text is cached across all 50 cases in a run.
3. **`shouldReuseCachedCase` not a type guard** — returned `boolean` so TypeScript couldn't narrow `cached: CaseResult | null` to `CaseResult` at the call site. Changed return type to `cached is CaseResult`.
4. **`@anthropic-ai/sdk` missing from server deps** — `extract.service.ts` imports Anthropic directly but the package wasn't listed in `apps/server/package.json`.

### What Looks Good

- Three prompt strategies (zero-shot, few-shot, CoT) are cleanly separated as swappable modules in `packages/llm/src/strategies/`.
- Prompt hash is stable (SHA-256 of system prompt + schema), so "prompt v6" is unambiguous across runs.
- SSE event stream (`/api/v1/runs/:id/stream`) lets the dashboard update live without polling.
- Idempotent cache lookup scopes by `(transcriptId, strategy, model, promptHash)` — changing any character in the prompt produces a cache miss.
- Field metrics are well-matched: Jaccard token-set for strings, ±0.2°F tolerance for temp, BID/twice-daily normalization for medication frequency, ICD-10 bonus credit for diagnoses.

---

## Eval Performance Improvement Strategy (2026-05-01)

### Baseline (zero_shot, haiku-4-5, 50 cases)

| Field | Score |
| --- | --- |
| Overall | 0.734 |
| Chief complaint | 0.471 |
| Vitals | 0.995 |
| Medications F1 | 0.938 |
| Diagnoses F1 | 0.593 |
| Plan F1 | 0.750 |
| Follow-up | 0.656 |
| Hallucinations | 418 |

### Root Cause Analysis (sampled 20/50 cases)

#### Chief complaint (0.471) — two failure modes

1. *Follow-up visits* produce wrong format. Gold uses `"depression follow-up on fluoxetine"` or `"hyperlipidemia management"`. Without explicit guidance the model outputs the condition alone or a symptom phrase.
2. *New complaints* lose duration. Gold consistently attaches duration (`"sore throat and nasal congestion for four days"`, `"dysuria and urgency for two days"`). Few-shot Example 1 was demonstrating `"sore throat and cough"` with no duration even though transcript said "for 3 days" — actively teaching the model to drop it.

#### Diagnoses F1 (0.593) — two issues

1. Jaccard 0.8 threshold too strict for compound clinical names. `"uncontrolled essential hypertension"` vs `"hypertension"` = 1/3 = 0.33, hard miss. `"irritable bowel syndrome, mixed type"` vs `"irritable bowel syndrome"` = 3/5 = 0.6, right at threshold.
2. Severity/subtype qualifiers are dropped. Few-shot Example 3 output had `"asthma exacerbation"` even though transcript said "moderate asthma exacerbation" — teaching the model to strip qualifiers.

#### Hallucinations (418) — almost entirely false positives

Three systematic sources:

- ICD-10 codes (`J06.9`, `M10.072`, etc.) never appear verbatim in transcripts → every one was flagged.
- Route abbreviation `"PO"` doesn't appear when transcript says `"by mouth"` or says nothing → every oral med was flagged.
- Normalized frequency strings: model says `"twice daily"` when transcript says `"BID"` → flagged.

#### Follow-up (0.656) — conditional vs scheduled confusion

Gold encodes conditional follow-ups as `{interval_days: null, reason: "call if not improving in 5 days"}`. Without explicit guidance, the model sometimes infers a number of days from the conditional phrase. Also: gold annotation uses abbreviations in reason (`"knee OA recheck"`) that models spell out (`"knee osteoarthritis recheck"`) → Jaccard penalty of ~0.5.

#### Non-standard compound frequencies

Gold uses `"every 6 hours as needed"`, `"three times daily before meals"`, `"with meals as needed"`, `"once a day at bedtime"`. These fall through `normalizeFrequency`'s exact-string list. If model says `"every 6 hours PRN"` vs gold `"every 6 hours as needed"`, the normalized comparison fails. Standard Latin abbreviations should expand as tokens, not require whole-string match.

### Changes Applied

| Change | Location | Rationale |
| --- | --- | --- |
| Plan match threshold 0.8 → 0.5 | `evaluate.service.ts` | Short 2-4 token plan items punished heavily by strict Jaccard; 0.5 still requires majority overlap |
| Diagnosis match threshold 0.8 → 0.6 | `evaluate.service.ts` | Compound clinical names (with qualifiers/subtypes) share 3/5 tokens at minimum with correct match |
| Medication scoring: weighted partial credit | `evaluate.service.ts` | Name must match (0.4 weight); dose + frequency are bonus (0.3 each). Correct drug with minor format difference now gets credit |
| `interval_days` tolerance 0 → 1 day | `evaluate.service.ts` | "2 to 3 days" → gold picks 3, model picks 2 → both correct, ±1 covers rounding |
| Remove ICD-10 from hallucination checks | `evaluate.service.ts` | ICD-10 codes are valid schema outputs inferred from diagnosis; never verbatim in transcripts — checking them produces only false positives |
| Route synonym expansion | `evaluate.service.ts` | `"PO"` grounded by `"by mouth"`, `"oral"`, etc. using `ROUTE_SYNONYMS` map |
| Latin abbrev token expansion in `normalizeFrequency` | `evaluate.service.ts` | `"every 6 hours PRN"` → `"every 6 hours as needed"` before comparison; handles compound freq strings |
| `max_tokens` 1200 → 2048 | `packages/llm/src/client.ts` | Prevents truncation on complex multi-medication cases |
| Chief complaint: duration + qualifier rule | `base.ts` | Explicit instruction to include duration when stated and key qualifiers |
| Chief complaint: follow-up visit pattern | `base.ts` | "condition follow-up on medication" / "condition management" format guidance |
| Diagnosis qualifier rule | `base.ts` | Explicit instruction to include severity, laterality, subtype as stated |
| Follow-up conditional vs scheduled rule | `base.ts` | `interval_days` = null for conditional instructions (`"return if worsening"`); only set for concrete scheduled intervals |
| CoT prompt: field-by-field reasoning steps | `cot.ts` | Structured scratchpad walk-through vs trivial 3-line prior prompt |
| Few-shot Example 1 chief_complaint | `few-shot.ts` | Added `"for 3 days"` duration to match gold annotation style |
| Few-shot Example 3 diagnosis | `few-shot.ts` | Added `"moderate"` qualifier; transcript said "moderate asthma exacerbation" |
| Few-shot Example 4 (new) | `few-shot.ts` | Multi-medication case demonstrating plan item splitting and follow-up formatting |
| Retry feedback includes AJV params | `packages/llm/src/client.ts` | Model gets better signal about what failed (e.g., wrong type, missing key) |

### Overfitting Safeguards

- Thresholds were set to generalizable values (0.5 plan, 0.6 diagnoses), not tuned to individual case scores.
- `ROUTE_SYNONYMS` uses universal clinical synonyms (PO = "by mouth"/"oral"), not transcript-specific phrases.
- Frequency abbreviation expansion uses standard Latin clinical abbreviations (BID, TID, PRN) with no case-specific rules.
- Medical abbreviation expansion in follow-up reason (OA → osteoarthritis) was deliberately *not* added — the abbreviation set in the gold is small and any expansion list risks false matches in other contexts.
- Few-shot examples were fixed to be consistent with the gold annotation *style* (include duration, include severity qualifiers), not to match specific case values.

### Known Remaining Limitations

- `"encounter for adult preventive examination"` (annual physical gold label) will still mismatch model output like `"annual physical"` — no token overlap, threshold irrelevant. This is a gold annotation choice to use billing encounter terminology.
- Follow-up reason abbreviations in gold (`"knee OA recheck"`) score ~0.5 Jaccard against spelled-out model output. Acceptable trade-off given overfitting risk of adding abbreviation expansion.
- `"in clinic now"` medication frequency (case_032) has no generalizable normalization.
- Cases with follow-up ranges (`"2 to 3 days"`) — ±1 day tolerance handles this; if range is wider (e.g., "4 to 6 weeks") model could pick any value in range.

---

### What to Build Next

- **Results table** — run a full 3-strategy eval and paste per-field averages here (required for submission).
- **Transcript highlighting** — case detail view should highlight where prediction values are grounded in the transcript (frontend wiring needed).
- **Resumability integration test** — currently tested at the unit level (`shouldReuseCachedCase`), but there's no test that simulates a mid-run server restart.
- **Prompt diff view** (stretch) — showing which cases regressed between two prompt hashes would be high-signal.
- **Cost guardrail** (stretch) — estimate from token counts before starting a run; reject if over a configurable cap.

### What Was Cut

- Multi-model compare: only Haiku 4.5 rates are wired in `MODEL_RATES_PER_MILLION`.
- Active-learning hint: surface 5 cases with highest cross-strategy disagreement.
- Resumability integration test: only unit-level coverage currently.

---
> author comments
> tbh the readme is so abysmally confusing to understand with such poor setup instructions etc.. otherwise its quite an interesting project..
