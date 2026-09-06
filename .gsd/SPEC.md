# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Project**: PassPort API Client Integration & External Tool Extension Management
> **Milestone**: v2.0 — PassPort Integration

## Vision

Empower the EGP Broker to act as a seamless client for the PassPort Protocol v1, dynamically registering with external learning tools (such as CodeWorkout, Web-CAT, etc.) and automatically dispatching cryptographically signed extension webhooks when students redeem passes for tool-backed assignments. This enables cross-platform deadline extensions while maintaining independent proxy and PassPort capabilities for all external LTI tools.

## Goals

1. **Dual-Role LtiTool Support**: Extend the existing `LtiTool` model and admin management to clearly support both external tools where LMS requests can be proxied (`supportsProxy`) and external tools that support the PassPort API for recording student extensions (`supportsPassport`), including separate key/secret pairs for each role.
2. **2-Phase Dynamic Registration Client**: Implement the client-side PassPort Dynamic Registration handshake, allowing administrators to initiate registration with an external tool (`POST [tool]/api/passport/v1/register`), securely receiving credentials via a callback endpoint (`POST /api/passport/v1/credentials?token=<cuid>`), and storing assigned endpoints and requested property sets.
3. **Admin Tool Management & Registration Status**: Provide rich controls and visual status badges on `/admin/tools` (`ToolEditPanel.vue`) to trigger dynamic registration, display live registration status (`NOT_REGISTERED`, `PENDING`, `REGISTERED`, `FAILED`), show timestamp and error details, and surface toast notifications.
4. **PassPort Extension Dispatch on Pass Redemption**: In `server/utils/redemptions.ts`, check if the assignment is associated with an `LtiTool` supporting PassPort. If so, build a compliant payload (with only the requested optional properties), sign it with HMAC-SHA256 (`X-PassPort-Signature`, `X-PassPort-Client-ID`, `X-PassPort-Timestamp`), and POST it to the tool's `extension_handler`.
5. **Fail-Fast Safety, Alerting, & Rollback**: If external tool extension sync fails, fail-fast by aborting pass redemption, sending an administrative `ntfy` alert with student/assignment/tool details, and displaying an on-screen student notification advising them to contact their instructor. If a downstream LMS sync fails after external tool sync, issue a signed `DELETE` rollback request.

## Non-Goals (Out of Scope)

- Implementing the *server* receiving side of the PassPort extension endpoint (the Broker is a *client* pushing extensions to tools; the tools implement the extension endpoint).
- Changes to LTI 1.3 launch proxying protocols or CAS authentication workflows.
- Arbitrary custom webhook payload formats beyond the PassPort Protocol v1 specification.

## Users

- **System Administrators**: Configure external LTI tools, toggle Proxy vs. PassPort roles, trigger dynamic registration, inspect registration statuses, and receive ntfy alerts if extension sync fails.
- **Instructors**: Link course assignments to external tools with confidence that student deadline extensions will propagate automatically to the tool.
- **Students**: Redeem resubmission/late passes with guaranteed synchronized deadlines in both Canvas and external tools, receiving immediate clear alerts if tool communication fails.

## Constraints

- **Strict Nuxt 4 Architecture**: Enforce layered sovereignty (stateless base components, feature-specific composables, Zod validation on all endpoints, projected database queries).
- **Environment Parity**: Run all migrations, tests, and builds inside the `app-dev` Docker container.
- **Protocol Fidelity**: Adhere strictly to the PassPort Protocol v1 specification defined in `docs/extension-api.md`.
- **100% Behavioral Coverage**: All new endpoints, utilities, and components must have corresponding Vitest unit tests.

## Success Criteria

- [ ] `LtiTool` schema supports both `supportsProxy` and `supportsPassport`, separate key/secret pairs, registration token, status enum, extension URL, and requested properties.
- [ ] Admin can initiate dynamic registration from `/admin/tools`, and the tool receives a Phase 1 POST request with secure callback URL.
- [ ] Broker's `/api/passport/v1/credentials` endpoint validates Phase 2 payload and updates tool status to `REGISTERED`.
- [ ] Admin UI displays live registration status, handles manual overrides, and shows actionable notifications on error.
- [ ] Pass redemption triggers HMAC-SHA256 signed extension request to tool's `extension_handler` when assignment is backed by a PassPort tool.
- [ ] Extension sync failure rolls back pass redemption, sends ntfy admin alert, and shows student advice message.
- [ ] All unit tests pass with zero regressions; ESLint and Prettier clean.
