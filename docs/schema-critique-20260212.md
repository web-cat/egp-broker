# Prisma Schema Critique

[prompt: analyze the schema.prisma file and critique it with the aim of providing clear, actionable feedback to improve the robustness, performance, and maintainability of the data model and to ensure adnerence to the best practices for Prisma data models described in
GEMINI.md. Place the resulting critique in new file
docs/schema-critique.md.]

This document analyzes the current `prisma/schema.prisma` against the best practices defined in `GEMINI.md` (specifically Section 7).

## 🚨 Critical Items

### 1. ID Generation Strategy (Section 7.3)

**Current:** The schema uses `@default(uuid())` for all ID fields.
**Requirement:** `GEMINI.md` explicitly mandates the use of **CUID2** (`@default(cuid())`) for its security, collision resistance, and sortability benefits in distributed systems.
**Action:** Replace all instances of `uuid()` with `cuid()`.

## ⚠️ Important Improvements

### 2. Housekeeping Fields (Section 7.2)

**Current:** Most models have `createdAt` and `updatedAt`, but there are exceptions:

- `Token`: Missing `updatedAt`. While tokens are often immutable, consistency is preferred unless explicitly unnecessary.
- `PassRedemption`: Uses `redeemedAt` instead of `createdAt` and lacks `updatedAt`.
  **Requirement:** "Every model should track its own lifecycle... Always include `createdAt` and `updatedAt`."
  **Action:**
- Add `updatedAt` to `Token` (or document exception).
- Standardize `PassRedemption` to use `createdAt` (aliased if needed) and add `updatedAt`.

### 3. Soft Deletes (Section 7.2)

**Current:** No models currently use `deletedAt`.
**Recommendation:** `GEMINI.md` suggests considering `deletedAt` for soft deletes.
**Action:** Evaluate adding `deletedAt` to key entities like `Course`, `Assignment`, and `PassType` to prevent accidental data loss and allow for recovery/auditing.

## ℹ️ Documentation & Maintainability

### 4. Rich Documentation Comments (Section 7.6)

**Current:** Rich comments (`///`) are present on `PassType` and related models, but missing from core models like `User`, `Course`, and the entire `Lti...` family.
**Requirement:** Use `///` for documentation that propagates to the Prisma Client.
**Action:** Add rich comments to `User` fields, `LtiPlatform` configuration, and `Course` LTI fields.

### 5. Explicit Relations (Section 7.5)

**Current:** Relations are generally clean, but some could be more explicit if they grow complex.
**Status:** Mostly compliant. The `User` <-> `Course` relation for `currentCourse` is correctly named (`UserCurrentCourse`).

## Summary of Recommended Actions

1.  **[High Priority]** global replace `uuid()` -> `cuid()`.
2.  **[Medium Priority]** Add missing `updatedAt` timestamps.
3.  **[Low Priority]** Add `///` comments to `User` and `Lti` models.
4.  **[Discussion]** Decide on Soft Deletes implementation for major entities.
