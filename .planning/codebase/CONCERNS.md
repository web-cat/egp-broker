# CONCERNS.md — Technical Debt, Issues & Areas of Concern

## 🔴 High Priority

### 1. Dead Code Block in LTI Launch Handler

**File:** `server/api/lti13/launch.post.ts` (lines 244–253)

Inside the Prisma transaction at step 5, there is a commented-out block that was originally planned to run `syncAssignmentEligibility()` inside the transaction but was never cleaned up. The comment trail ends without doing anything:

```typescript
if (assignment) {
  // We can't await this inside the transaction if it uses a separate prisma client instance
  // ... actually, let's just do it here, but we need to capture the ID.
  // Better yet, let's return the assignment ID from the transaction along with the user.
}
```

This is dead code — the block has an empty body. The actual `syncAssignmentEligibility` call happens correctly after the transaction, but the dead block inside creates a misleading N+1 query pattern: the assignment is queried **twice** inside the transaction (once in step 1-5 and again in lines 262–288) to retrieve the `assignmentId`. This is redundant and increases transaction duration.

**Risk:** Performance (extra DB roundtrip in every launch transaction).
**Fix:** Remove the empty `if (assignment)` block inside the transaction. Pass `assignmentId` out from the existing step 4 logic instead of re-querying.

---

### 2. Swagger UI Available in Production

**Files:** `server/api/docs/index.get.ts`, `server/api/docs/ui.get.ts`

The OpenAPI spec and Swagger UI appear to be available in all environments with no environment-based guard. The E2E spec `test/e2e/swagger/swagger-protection.spec.ts` exists specifically to verify protection — suggesting this is known but may not be fully solved.

**Risk:** Exposes full API surface to unauthenticated users in production.
**Fix:** Wrap both handlers with a dev-only guard (`if (process.env.NODE_ENV !== 'development') throw createError(403, 'Not available')`) or restrict via Nitro route rules.

---

### 3. Missing Rate Limiting on LTI Launch Endpoint

**File:** `server/api/lti13/launch.post.ts`

The global `nuxt-security` rate limiter is configured at 150 requests/5 minutes globally. The LTI launch and login endpoints are not subject to any endpoint-specific rate limiting. A malicious actor could flood the launch endpoint with crafted requests to probe nonces or cause platform lookups at high volume.

**Risk:** Medium security / DoS.
**Fix:** Consider applying a tighter per-IP rate limit on `/api/lti13/launch` and `/api/lti13/login`.

---

## 🟡 Medium Priority

### 4. `platformApiKey` Stored in Plain Text

**Prisma model:** `LtiIdentity.platformApiKey String?`

The Canvas API key for each user is stored as plain text in the database. If the DB is compromised, all user API keys are exposed.

**Risk:** Security — credential exposure.
**Fix:** Encrypt at the application layer before writing, or use a secrets management approach. At minimum, document the risk in the model.

---

### 5. LTI `launch.post.ts` Has Excessive Complexity

**File:** `server/api/lti13/launch.post.ts` (328 lines)

This handler violates the "no inline business logic" rule from GEMINI.md. The transaction block alone is 240+ lines with 6 nested levels and multiple upsert patterns. It is tested extremely lightly (the `lti13/config.test.ts` exists but tests config, not launch).

**Risk:** Hard to maintain, almost no unit test coverage of the launch flow.
**Fix:** Extract `handleLtiLaunch()` into `server/utils/lti-launch.ts`, covering deployment upsert, user/identity resolution, course upsert, assignment resolution as separate well-named functions. Each should have its own unit test.

---

### 6. Assignment Resolution Has Fragile Fallback Chain

**File:** `server/api/lti13/launch.post.ts` (lines 179–228)

Assignment lookup uses a 3-step cascade fallback:
1. Find by `resourceLinkId`
2. If not found, find by `canvasAssignmentId`
3. If still not found, find by `title` where both IDs are `null`

Step 3 (title-only match) is semantically fragile — two assignments with the same title will cause an incorrect merge. This is documented with a comment ("synced legacy fallback") but represents a real data integrity risk.

**Risk:** Data integrity — incorrect assignment ID association.
**Fix:** In step 3, add a `@@unique([courseId, title])` constraint to `Assignment` or remove the title-only fallback entirely in favor of explicit Canvas sync.

---

### 7. Email Configuration Not Validated at Startup

**Runtime config:** `nuxt.config.ts` (`runtimeConfig.email.*`)

If `NUXT_EMAIL_HOST` or `NUXT_EMAIL_USER` are missing, the app starts normally but email sending silently fails only when triggered. There is no startup validation or connectivity check.

**Risk:** Silent email failures in staging/production.
**Fix:** Add a server plugin or Nitro startup hook that verifies required email config keys at boot when `NODE_ENV === 'production'`.

---

### 8. `usePreferences.ts` Is the Only Pinia Store

**File:** `app/stores/usePreferences.ts`

Currently, application state beyond session (course context, assignments, pass pools) appears to be managed entirely via `useFetch` reactive state within composables. As the app grows, this approach can lead to stale data across routes or unnecessary refetches.

**Risk:** Scalability — no canonical cache for frequently-accessed course data.
**Consideration:** Evaluate whether `currentCourse` or `passTypes` data should live in a Pinia store vs. per-composable reactive state.

---

## 🟢 Low Priority / Observations

### 9. `notes.txt` at Root

A `notes.txt` file exists at the project root. Likely personal dev notes; should either be moved to `.planning/` or added to `.gitignore`.

### 10. Default Language Mismatch

`nuxt.config.ts` sets `defaultLocale: 'fr'` and `htmlAttrs.lang: 'fr'`, but the `titleTemplate` reads `'%s | Nuxt Boilerplate'` — suggesting incomplete rebranding from a boilerplate template. This is cosmetic but visible to end users.

### 11. `canvasAssignmentId` Not Indexed

`Assignment.canvasAssignmentId` is used in the LTI launch query fallback path (`where: { courseId, canvasAssignmentId }`) but has no `@@index`. At scale this becomes a slow table scan per launch.

**Fix:** Add `@@index([courseId, canvasAssignmentId])` to the `Assignment` model.

### 12. `dev/mock-launch.post.ts` Needs Guard

**File:** `server/api/dev/mock-launch.post.ts`

This dev-only endpoint should be guarded to prevent it from being accessible in production. Confirm it has an environment check or is excluded via build configuration.
