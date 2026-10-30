---
phase: 1
plan: 2
wave: 2
gap_closure: false
---

# Plan 1.2: PassPort v1.2 Registration Handshake & Admin UI

## Objective

Update the PassPort dynamic registration handshake to advertise PassPort version 1.2, extract and persist `endpoints.status_handler` as `passportStatusUrl` upon Phase 2 callback, and enhance the administrator `ToolEditPanel.vue` interface so admins can view, enter, and update `passportStatusUrl` alongside existing PassPort endpoint configurations.

## Context

- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md` (DECISION-019)
- `extension-api.v1.2.md` Section 3 (Dynamic Registration)
- `server/utils/passport.ts`
- `app/components/features/admin/ToolEditPanel.vue`
- `test/unit/server/utils/passport.test.ts`
- `test/unit/app/components/features/admin/ToolEditPanel.spec.ts`

## Tasks

<task type="auto">
  <name>Update PassPort registration service for version 1.2 and status handler persistence</name>
  <files>
    server/utils/passport.ts
    test/unit/server/utils/passport.test.ts
  </files>
  <action>
    1. In `server/utils/passport.ts`:
       - In `initiatePassPortRegistration`:
         - Set `passport_version: '1.2'` in `PassPortPhase1Request` payload.
       - In `handlePassPortCredentialsDelivery`:
         - Extract `validated.endpoints.status_handler`.
         - If present, normalize (using `normalizePassPortExtensionUrl` or equivalent) and persist to `data.passportStatusUrl`.
         - Include `passportStatusUrl` in the database update.
    2. In `test/unit/server/utils/passport.test.ts`:
       - Verify `initiatePassPortRegistration` sends `passport_version: '1.2'`.
       - Verify `handlePassPortCredentialsDelivery` extracts `status_handler` and saves `passportStatusUrl` on the tool.
       - Verify handling when `status_handler` is omitted (backward-compatibility with v1.0/v1.1 tools).
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/server/utils/passport.test.ts`
  </verify>
  <done>
    Unit tests confirm Phase 1 dispatches PassPort 1.2 registration and Phase 2 correctly captures and stores `passportStatusUrl`.
  </done>
</task>

<task type="auto">
  <name>Enhance ToolEditPanel to configure and display passportStatusUrl</name>
  <files>
    app/components/features/admin/ToolEditPanel.vue
    test/unit/app/components/features/admin/ToolEditPanel.spec.ts
  </files>
  <action>
    1. In `app/components/features/admin/ToolEditPanel.vue`:
       - Add `passportStatusUrl: string` to the component form state.
       - Initialize `passportStatusUrl: ''` in default state.
       - In `watch` on `props.tool`, populate `state.passportStatusUrl = tool.passportStatusUrl ?? ''`.
       - In template, within the "Advanced PassPort Details" section (under `passportExtensionUrl`):
         - Add a `BaseFormInput` for `passportStatusUrl`:
           - label="PassPort Status Query URL"
           - name="passportStatusUrl"
           - placeholder="https://external-tool.edu/api/passport/v1/status"
           - help="Optional endpoint for querying student submission status, feedback links, and staff notices."
    2. In `test/unit/app/components/features/admin/ToolEditPanel.spec.ts`:
       - Update mock tools to include `passportStatusUrl`.
       - Add test asserting that `passportStatusUrl` is rendered when `supportsPassport` is true.
       - Verify that updating `passportStatusUrl` submits the updated field in `saveTool`.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/app/components/features/admin/ToolEditPanel.spec.ts`
  </verify>
  <done>
    ToolEditPanel displays the status URL input field, populates from tool record, and submits updates cleanly. All unit tests pass.
  </done>
</task>

## Must-Haves

After all tasks complete, verify:

- [ ] `initiatePassPortRegistration` advertises `passport_version: '1.2'`.
- [ ] `handlePassPortCredentialsDelivery` stores `status_handler` into `passportStatusUrl`.
- [ ] `ToolEditPanel.vue` presents a field for PassPort Status Query URL and emits it on save.
- [ ] All unit tests in `passport.test.ts` and `ToolEditPanel.spec.ts` pass with 100% success.

## Success Criteria

- [ ] All tasks verified passing.
- [ ] Must-haves confirmed.
- [ ] No regressions across project test suite.
