---
phase: 4
plan: 1
wave: 1
depends_on: []
files_modified: []
autonomous: true
user_setup: []

must_haves:
  truths:
    - 'All unit tests across the entire repository execute and achieve 100% pass rate with zero regressions'
    - 'All PassPort v1.2 status query, registration handshake, API refresh endpoints, and GTA dashboard UI tests pass'
    - 'No security vulnerabilities, unsanitized HTML injections, or broken links exist across the new surface'
  artifacts:
    - '.gsd/phases/4/1-SUMMARY.md'
    - '.gsd/phases/4/VERIFICATION.md'
  key_links:
    - 'docker compose exec app-dev pnpm test:unit'
---

# Plan 4.1: Milestone v7.0 Full Repository Verification & Security Audit

<objective>
Execute a full, comprehensive verification across the entire project test suite within the Docker development container (`app-dev`). Confirm 100% behavioral coverage, zero test regressions, and complete end-to-end alignment with the requirements in `REQ-701` through `REQ-710`.

Purpose: Provides empirical proof that Milestone v7.0 (PassPort v1.2 External Tool Status & GTA Submission Links) satisfies all specifications without breaking existing CBTF, GTA, or PassPort functionality.
Output: Verification report and milestone wrap-up documentation.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- .gsd/REQUIREMENTS.md
- .gsd/DECISIONS.md
- test/unit/shared/models/passport.test.ts
- test/unit/server/utils/passport-status.test.ts
- test/unit/server/api/gta-interview-refresh-status.test.ts
- test/unit/app/composables/useGtaInterviewConsole.spec.ts
- test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts
</context>

<tasks>

<task type="auto">
  <name>Run targeted Milestone v7.0 unit test suite</name>
  <files>
    test/unit/shared/models/passport.test.ts
    test/unit/server/utils/passport.test.ts
    test/unit/server/utils/passport-status.test.ts
    test/unit/server/api/gta-interview-refresh-status.test.ts
    test/unit/shared/utils/html.test.ts
    test/unit/app/composables/useGtaInterviewConsole.spec.ts
    test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts
  </files>
  <action>
    Execute all unit tests specifically added or touched during Milestone v7.0 inside the `app-dev` container.
    Verify:
    1. PassPort v1.2 registration and status models (`passport.test.ts`).
    2. PassPort v1.2 status query client engine and HMAC request signing (`passport-status.test.ts`).
    3. PassPort v1.2 single and batch status refresh endpoints (`gta-interview-refresh-status.test.ts`).
    4. HTML sanitization of external staff notices (`html.test.ts`).
    5. Composable status caching, manual refresh, and 15-minute staleness interval (`useGtaInterviewConsole.spec.ts`).
    6. GTA interview console UI deep links, staff notice callouts, and refresh buttons (`GtaInterviewConsole.spec.ts`).
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/shared/models/passport.test.ts test/unit/server/utils/passport.test.ts test/unit/server/utils/passport-status.test.ts test/unit/server/api/gta-interview-refresh-status.test.ts test/unit/shared/utils/html.test.ts test/unit/app/composables/useGtaInterviewConsole.spec.ts test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts`
  </verify>
  <done>
    All milestone-specific test suites pass with 100% success rate.
  </done>
</task>

<task type="auto">
  <name>Run full repository unit test suite</name>
  <files>
    test/unit/
  </files>
  <action>
    Execute the entire repository unit test suite inside Docker: `docker compose exec app-dev pnpm test:unit`.
    Confirm that all 185+ test files pass without a single failure or regression.
  </action>
  <verify>
    `docker compose exec app-dev pnpm test:unit`
  </verify>
  <done>
    Full project test suite passes with 100% green tests.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Targeted v7.0 test suites pass completely.
- [ ] Full repository unit test suite passes with zero regressions.
- [ ] All requirements REQ-701 through REQ-710 confirmed satisfied.
</verification>

<success_criteria>

- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Empirical test execution logs recorded
      </success_criteria>
