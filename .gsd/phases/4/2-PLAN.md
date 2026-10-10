---
phase: 4
plan: 2
wave: 2
---

# Plan 4.2: Full Repository Test Suite Audit & Milestone Verification

## Objective

Execute the full repository-wide unit test suite to guarantee zero regressions across all system modules (GTA grading interviews, PassPort, LTI NRPS, Proctor training, and CBTF scheduler). Audit and document empirical evidence for all Milestone v6.0 requirements (REQ-601 through REQ-611), generate `.gsd/phases/4/VERIFICATION.md`, and complete the roadmap updates.

## Context

- `.gsd/SPEC.md`
- `.gsd/ROADMAP.md`
- `.gsd/REQUIREMENTS.md`
- `.gsd/phases/1/VERIFICATION.md`
- `.gsd/phases/2/VERIFICATION.md`
- `.gsd/phases/3/VERIFICATION.md`

## Tasks

<task type="auto">
  <name>Run full repository test suite and resolve any regressions</name>
  <files>
    tests/
    test/
  </files>
  <action>
    1. Run the entire unit test suite inside Docker: `docker compose exec app-dev pnpm test:unit`.
    2. Inspect results across all test suites (server utilities, API endpoints, composables, presenter components, and shared schemas).
    3. If any test failure or regression is detected, identify the root cause and resolve it immediately following SSoT and Nuxt 4 conventions.
    4. Confirm 100% test pass rate with zero errors.
  </action>
  <verify>
    docker compose exec app-dev pnpm test:unit
  </verify>
  <done>
    Entire test suite passes cleanly inside Docker container.
  </done>
</task>

<task type="auto">
  <name>Perform milestone audit and generate Phase 4 verification report</name>
  <files>
    .gsd/phases/4/VERIFICATION.md
    .gsd/REQUIREMENTS.md
    .gsd/ROADMAP.md
    .gsd/STATE.md
  </files>
  <action>
    1. Verify all 11 requirements (REQ-601 through REQ-611) against empirical test evidence.
    2. Update `.gsd/REQUIREMENTS.md` marking all requirements as Complete with test references.
    3. Create `.gsd/phases/4/VERIFICATION.md` detailing:
       - Summary of Phase 4 deliverables.
       - Verification proofs for proctor hot-spare failovers and REQ-611 simulation results.
       - Complete test matrix showing all passing suites.
    4. Update `.gsd/ROADMAP.md` marking Phase 4 and all Milestone v6.0 Must-Haves complete.
    5. Update `.gsd/STATE.md` recording milestone completion.
  </action>
  <verify>
    test -f .gsd/phases/4/VERIFICATION.md && grep -q "REQ-611" .gsd/phases/4/VERIFICATION.md
  </verify>
  <done>
    Phase 4 verification report created, requirements marked complete, and milestone state finalized.
  </done>
</task>

## Success Criteria

- [ ] Complete test suite passes with 0 failures across the codebase.
- [ ] Requirements REQ-601 through REQ-611 verified with empirical proof.
- [ ] `.gsd/phases/4/VERIFICATION.md` written and committed.
- [ ] `.gsd/ROADMAP.md` and `.gsd/STATE.md` updated.
