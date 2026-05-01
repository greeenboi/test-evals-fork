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
