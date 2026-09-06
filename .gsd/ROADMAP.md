# ROADMAP.md

> **Current Phase**: Phase 1
> **Milestone**: v2.0 — PassPort Integration

## Must-Haves (from SPEC)

- [ ] Dual-role `LtiTool` model with `supportsProxy` and `supportsPassport`, separate key/secret pairs, and registration metadata.
- [ ] 2-Phase Dynamic Registration client handshake (Phase 1 POST to tool registration URL with tokenized callback, Phase 2 POST to `/api/passport/v1/credentials`).
- [ ] Admin tool management UI on `/admin/tools` with role toggles, dual credentials, registration trigger button, status badges, and notifications.
- [ ] HMAC-SHA256 signed PassPort extension webhook dispatch on pass redemption respecting requested properties.
- [ ] Fail-fast safety: Abort redemption on tool sync failure, send `ntfy` admin alert, return student guidance error, and support downstream `DELETE` rollback.
- [ ] 100% behavioral test coverage with Vitest; ESLint and Prettier clean.

---

## Phases

### Phase 1: Foundation & Data Layer

**Status**: ✅ Completed (2026-09-06)
**Objective**: Extend `LtiTool` model in `prisma/schema.prisma` with dual roles, separate credentials, registration token, status enum, and PassPort metadata. Run migration in docker. Create shared Zod schemas and TypeScript interfaces in `shared/models/tool.ts` and `shared/models/passport.ts`. Write unit tests for schemas and model operations.
**Requirements**: REQ-01, REQ-02, REQ-10

**Deliverables**:

- Prisma schema updates:
  - `PassPortRegistrationStatus` enum (`NOT_REGISTERED`, `PENDING`, `REGISTERED`, `FAILED`).
  - `LtiTool` fields: `supportsProxy`, `supportsPassport`, `passportClientId`, `passportClientSecret`, `passportRegistrationUrl`, `passportExtensionUrl`, `passportRegistrationToken`, `passportRegistrationStatus`, `passportRegistrationError`, `passportRegisteredAt`, `passportRequestedProperties`.
  - Retain `supportsExtensionApi` for backwards compatibility.
- Prisma migration generated and applied via `docker compose exec app-dev pnpm prisma migrate dev`.
- Shared Zod validation schemas and TypeScript contracts in `shared/models/passport.ts` and `shared/models/tool.ts`.
- Unit tests verifying model validation, projection schemas, and defaults.

---

### Phase 2: PassPort Dynamic Registration Handshake Engine

**Status**: ✅ Completed (2026-09-06)
**Objective**: Build server-side registration orchestration (`server/utils/passport.ts`), Phase 1 dispatch endpoint (`POST /api/admin/tools/:id/passport/register`), and Phase 2 credentials callback endpoint (`POST /api/passport/v1/credentials?token=<cuid>`). Write unit tests covering registration flows, error states, and token validation.
**Requirements**: REQ-03, REQ-04, REQ-10

**Deliverables**:

- `server/utils/passport.ts`:
  - Token generation and verification utilities.
  - Phase 1 outbound POST request dispatch with timeout and error handling.
  - Status transition helpers (`markRegistrationPending`, `completeRegistration`, `failRegistration`).
- Server endpoints:
  - `POST /api/admin/tools/:id/passport/register`: Admin endpoint to initiate Phase 1 dynamic registration.
  - `POST /api/passport/v1/credentials`: Public webhook receiver with query parameter `?token=<cuid>` to accept tool credentials, store extension handler URL and requested properties, and update tool to `REGISTERED`.
- Comprehensive Vitest unit tests covering:
  - Phase 1 dispatch (successful 202 Accepted response, network error, invalid registration URL).
  - Phase 2 callback (token match, token mismatch/not found, invalid body, successful credential storage).

---

### Phase 3: Admin Tool Management UI & Registration Feedback

**Status**: ✅ Complete
**Objective**: Update `ToolEditPanel.vue` and `app/pages/admin/tools.vue` with Proxy and PassPort role toggles, dedicated credential inputs, dynamic registration trigger button, status badges (`NOT_REGISTERED`, `PENDING`, `REGISTERED`, `FAILED`), error displays, and user notifications. Write unit tests for UI states and composables.
**Requirements**: REQ-05, REQ-10

**Deliverables**:

- `ToolEditPanel.vue`:
  - Role selection checkboxes: "LTI Proxy" (`supportsProxy`) and "PassPort Extension" (`supportsPassport`).
  - Dual credential sections:
    - LTI Proxy Credentials (Key, Secret).
    - PassPort Configuration (Registration URL, Extension Handler URL, Client ID, Client Secret).
  - Dynamic Registration Action Station:
    - "Register with PassPort" action button (enabled when `passportRegistrationUrl` is present).
    - Status Badge indicator (`Not Registered`, `Pending`, `Registered`, `Failed`).
    - Error banner displaying `passportRegistrationError` with dismiss/retry.
    - Last registered timestamp indicator.
  - User feedback: Toasts on registration initiate, success, or failure.
- Update `useLtiTools.ts` composable to expose registration trigger function and status polling/refresh.
- Vitest unit tests for component rendering, interaction, and role toggling.

---

### Phase 4: Extension Dispatch, Pass Redemption Hook & Fail-Fast Alerting

**Status**: ⬜ Not Started
**Objective**: Build HMAC-SHA256 PassPort request signer with property filtering. Integrate into `server/utils/redemptions.ts` to dispatch extensions on pass redemption. Implement fail-fast transaction rollback, `ntfy` admin alert via `alert.service.ts`, student error advice, and downstream rollback `DELETE` handling. Write unit tests covering signing, redemption, failure alerts, and rollback.
**Requirements**: REQ-06, REQ-07, REQ-08, REQ-09, REQ-10

**Deliverables**:

- `server/utils/passport.ts`:
  - `signPassPortRequest`: HMAC-SHA256 signer attaching `X-PassPort-Client-ID`, `X-PassPort-Signature`, `X-PassPort-Timestamp`.
  - `buildPassPortExtensionPayload`: Formats context, user, resource, and extension payloads, strictly omitting optional fields not in `passportRequestedProperties`.
  - `sendPassPortExtension`: Dispatches POST to tool `extension_handler`.
  - `sendPassPortRollback`: Dispatches signed DELETE to tool `extension_handler`.
- `server/services/alert.service.ts`:
  - `notifyPassPortSyncFailure`: Sends urgent admin alert via `ntfy` detailing student, assignment, course, tool name, and error message.
- `server/utils/redemptions.ts`:
  - Pre-redemption or in-redemption PassPort dispatch when `assignment.tool.supportsPassport === true`.
  - Fail-fast handling: If dispatch fails, rollback transaction, trigger admin ntfy alert, and throw structured user-facing error with student advice.
  - Downstream failure rollback: If Canvas/LMS sync fails subsequently, invoke `sendPassPortRollback`.
- Vitest unit tests covering:
  - Request signing and header generation.
  - Property set filtering according to `passportRequestedProperties`.
  - Pass redemption with successful PassPort tool dispatch.
  - Pass redemption failure when PassPort tool fails (fail-fast, no pass deduction).
  - Admin `ntfy` notification triggered on sync failure.
  - Rollback signed DELETE dispatch on downstream failure.
