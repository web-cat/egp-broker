---
phase: 2
plan: 1
wave: 1
gap_closure: false
---

# Plan 2.1: PassPort v1.2 Status Query Client Engine

## Objective

Implement the PassPort Protocol v1.2 status query client in `server/utils/passport.ts`. This engine constructs the signed identifying payload (`context`, `user`, `resource`) conforming to `extension-api.v1.2.md`, authenticates requests via HMAC-SHA256 headers, validates external tool responses using Zod schemas, transforms results into `CachedSubmissionStatus`, and provides graceful failure handling.

## Context

- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md` (DECISION-019, DECISION-020)
- `extension-api.v1.2.md` Section C (Submission Status Query Endpoint)
- `server/utils/passport.ts`
- `shared/models/passport.ts`
- `test/unit/server/utils/passport-status.test.ts`

## Tasks

<task type="auto">
  <name>Implement PassPort v1.2 status payload builder and query client</name>
  <files>
    server/utils/passport.ts
  </files>
  <action>
    1. In `server/utils/passport.ts`:
       - Define `BuildPassPortStatusParams` interface matching context, user, and resource parameters.
       - Implement `buildPassPortStatusPayload(params: BuildPassPortStatusParams): PassPortStatusPayload`:
         - Filter optional fields against `requestedProperties` (matching the existing `buildPassPortExtensionPayload` behavior).
         - Validate result against `passPortStatusPayloadSchema`.
       - Implement `queryPassPortSubmissionStatus`:
         ```ts
         export async function queryPassPortSubmissionStatus(
           tool: {
             passportClientId?: string | null
             passportClientSecret?: string | null
             passportStatusUrl?: string | null
             passportExtensionUrl?: string | null
           },
           params: BuildPassPortStatusParams
         ): Promise<CachedSubmissionStatus | null>
         ```
         - Resolve destination status endpoint: `tool.passportStatusUrl || (tool.passportExtensionUrl ? normalizePassPortStatusUrl(tool.passportExtensionUrl.replace(/\/extensions?$/, '/status')) : null)`.
         - If no status endpoint or missing credentials (`passportClientId`, `passportClientSecret`), return `null`.
         - Build status payload using `buildPassPortStatusPayload`.
         - Sign request with `signPassPortRequest(tool.passportClientSecret, payload)`.
         - Send POST request via `$fetch` with timeout (10000ms) and headers:
           - `X-PassPort-Client-ID`: `tool.passportClientId`
           - `X-PassPort-Signature`: `signature`
           - `X-PassPort-Timestamp`: `String(timestamp)`
           - `Content-Type`: `application/json`
         - Parse response with `passPortStatusResponseSchema.parse(res)`.
         - Transform using `toCachedSubmissionStatus(parsed)`.
         - Catch network or external tool errors: log warning and return `null` (resilient failure mode).
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/shared/models/passport.test.ts`
  </verify>
  <done>
    `buildPassPortStatusPayload` and `queryPassPortSubmissionStatus` are implemented and compile without type errors.
  </done>
</task>

<task type="auto">
  <name>Create unit tests for PassPort status query engine</name>
  <files>
    test/unit/server/utils/passport-status.test.ts
  </files>
  <action>
    1. Create `test/unit/server/utils/passport-status.test.ts`:
       - Mock global `$fetch`.
       - Test payload filtering based on `requestedProperties` (verifies `context`, `user`, and `resource` optional keys).
       - Test HMAC-SHA256 signature headers generated and sent in `$fetch`.
       - Test multi-submission response parsing (verifies `latestSubmissionUrl` points to `most_recent_submission`, `gradingSubmissionUrl` points to `submission_for_grading`, and `staffNotice` is captured).
       - Test single submission response parsing (verifies `latestSubmissionUrl` points to `submission_for_grading` and `gradingSubmissionUrl` is null).
       - Test zero submissions response (verifies null urls).
       - Test resilience when external tool throws 404/500/timeout: confirms function returns `null` without crashing.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/server/utils/passport-status.test.ts`
  </verify>
  <done>
    All unit tests in `passport-status.test.ts` pass with 100% success.
  </done>
</task>

## Must-Haves

After all tasks complete, verify:

- [ ] `buildPassPortStatusPayload` correctly formats and filters payload according to tool requested properties.
- [ ] `queryPassPortSubmissionStatus` attaches valid HMAC-SHA256 signature headers.
- [ ] Multi-submission responses separate latest submission from grading submission.
- [ ] External errors (network failure, non-200 responses) return null gracefully without unhandled exceptions.
- [ ] All unit tests pass.

## Success Criteria

- [ ] All tasks verified passing.
- [ ] Must-haves confirmed.
- [ ] No regressions in test suite.
