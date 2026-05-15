# PassPort Protocol v1

## Cross-Platform Extension Management Documentation

This document outlines the improved API design for a late pass management system (the "Broker") to communicate student deadline extensions to external Learning Tools (LTs).

### 1. Protocol Architecture

The PassPort API follows a **Sessionless Signed-Webhook** pattern.

1. **Tool Registration:** Each External Learning Tool registers its extension handler URL and a shared `client_secret` with the Broker.
2. **Notification:** When a pass is redeemed, the Broker signs the request payload using the shared secret and pushes it to the tool. The tool verifies the signature on receipt without needing to manage session tokens.

### 2. Data Interchange Specification

#### A. Authentication (Sessionless Request Signing)

Every request from the Broker to the Tool must include an `X-PassPort-Signature` header. This is an HMAC-SHA256 hash of the request body using the shared `client_secret`.

**Signature Generation:**

1. Serialize the JSON request body.
2. Compute `HMAC-SHA256(key=client_secret, message=serialized_body)`.
3. Send the resulting hex string in the header.

**Headers:**

- `X-PassPort-Client-ID`: The unique ID for the Broker instance.
- `X-PassPort-Signature`: The computed HMAC signature.
- `X-PassPort-Timestamp`: Unix timestamp (to prevent replay attacks; tools should reject requests older than 5 minutes).

#### B. The Extension Request (POST)

**Endpoint:** `[Tool_Registered_URL]/passport/v1/extension`

**Request Body (JSON):**

```json
{
  "request_id": "uuid-v4-idempotency-key",
  "context": {
    "lms_instance_guid": "stable-canvas-guid-123",
    "issuer": "https://canvas.instructure.com",
    "lti_context_id": "course-xyz-789",
    "// Optional Fields (Sent only if requested)": "...",
    "lms_instance": "https://canvas.vt.edu",
    "lti_deployment_id": "deployment-id-456",
    "canvas_course_id": "12345"
  },
  "user": {
    "lti_user_id": "lti-user-sub-12345",
    "// Optional Fields (Sent only if requested)": "...",
    "broker_user_id": "clxb123450000ud8ps8h9zzzz",
    "canvas_user_id": "98765",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "student@university.edu",
    "display_name": "Jane Doe",
    "course_role": "STUDENT"
  },
  "resource": {
    "lti_resource_link_id": "lti-resource-link-id-001",
    "// Optional Fields (Sent only if requested)": "...",
    "broker_assignment_id": "clxb123450000ud8ps8h9aaaa",
    "canvas_assignment_id": "55555",
    "title": "Introduction to React Hooks",
    "external_url": "https://tool.com/assignment/1"
  },
  "extension": {
    "pass_type": "24_HOUR_FREE_PASS",
    "original_due_date": "2023-10-01T23:59:59Z",
    "new_due_date": "2023-10-02T23:59:59Z",
    "applied_at": "2023-10-01T10:00:00Z"
  }
}
```

#### B.1. Property Sets

To respect data privacy, the Broker only sends optional properties if the Tool explicitly requests them during registration.

| Category | **Baseline (Always Sent)** | **Optional (Requested)** |
| :--- | :--- | :--- |
| **Context** | `lms_instance_guid`, `issuer`, `lti_context_id` | `lms_instance`, `lti_deployment_id`, `canvas_course_id` |
| **User** | `lti_user_id` | `broker_user_id`, `canvas_user_id`, `first_name`, `last_name`, `email`, `display_name`, `course_role` |
| **Resource** | `lti_resource_link_id` | `broker_assignment_id`, `canvas_assignment_id`, `title`, `external_url` |
| **Extension**| *All fields are mandatory* | N/A |

#### C. Response Codes

- **200 OK:** Extension successfully recorded.
- **401 Unauthorized:** Signature mismatch or timestamp expired.
- **404 Not Found:** User or Resource not recognized.
- **409 Conflict:** A later due date is already active for this student.

### 3. Dynamic Registration

The Broker can automatically configure itself for a tool using a **Registration Handshake**.

#### A. Registration Request (Broker -> Tool)

The Broker initiates registration by sending a POST request to the tool's Registration URL (provided by the tool administrator).

**Method:** `POST`
**Body (JSON):**

```json
{
  "broker_base_url": "https://egp-broker.university.edu",
  "passport_version": "1.0"
}
```

#### B. Registration Response (Tool -> Broker)

The Tool responds with its configuration and the credentials the Broker must use for all future requests.

**Body (JSON):**

```json
{
  "tool_name": "OpenDSA",
  "passport_version": "1.0",
  "endpoints": {
    "extension_handler": "https://opendsa.org/api/passport/grant"
  },
  "requested_properties": {
    "context": ["canvas_course_id"],
    "user": ["first_name", "last_name", "email"],
    "resource": ["canvas_assignment_id", "title"]
  },
  "credentials": {
    "client_id": "broker-assigned-id-001",
    "client_secret": "randomly-generated-shared-secret"
  }
}
```

### 4. Implementation Workflow

1. **Discovery:** Admin enters the Tool's Registration URL into the Broker.
2. **Registration:** Broker POSTs its details to the Tool and receives a `client_id` and `client_secret`.
3. **Broker Validation:** When a student requests an extension, the Broker verifies they have enough passes.
4. **Request Signing:** Broker generates the JSON payload, signs it with the `client_secret`, and attaches the `X-PassPort-Signature` and `X-PassPort-Client-ID` headers.
5. **Tool Sync:** Broker POSTs to the tool's `extension_handler`.
6. **Verification:** The Tool uses the `X-PassPort-Client-ID` to find the secret, re-calculates the HMAC, and updates its database.
7. **LMS Sync:** Broker calls the Canvas API to update the gradebook override.
8. **Finalize:** Broker decrements the pass balance.

### 5. Failure Recovery (Rollback)

If the LMS sync fails, the Broker sends a **DELETE** request to the `extension_handler` using the same signing protocol and the original `request_id`. The tool must revert the specific extension associated with that ID.
