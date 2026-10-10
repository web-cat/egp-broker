Searched for "child_process|exec\(|spawn\(|eval\(|new Function"
Searched for "queryRaw|executeRaw"
Listed directory server
Viewed package.json:1-70
Searched for "handlebars"
Viewed template-renderer.ts:1-116
Listed directory api
Viewed nuxt.config.ts:1-100
Viewed nuxt.config.ts:100-200
Viewed nuxt.config.ts:200-260

While this application is **not vulnerable to the Next.js Server Actions RCE attack** (and has very strong architectural guardrails against RCE in general), every web stack has its own specific threat vectors.

Here is a security analysis of the common penetration vectors for this application architecture (Nuxt 4, Nitro, Prisma, LTI 1.3, Proxy endpoints):

---

### 1. Remote Code Execution (RCE) — _Risk: Negligible_

In Node.js applications, RCE typically occurs through three patterns:

1. **Unsafe Evaluation:** `eval()`, `new Function()`, or `vm.runInContext()` on untrusted input.
2. **Command Injection:** Spawning shell processes (`child_process.exec`, `spawn`) using unsanitized user strings.
3. **Unsafe Deserialization / Template Injection:** E.g., `node-serialize` or evaluating user-submitted template strings in Handlebars.

**Status in this codebase:**

- **No dynamic shell or code evaluation:** There are zero instances of `child_process`, `eval`, or `new Function`.
- **Safe Template Rendering:** Handlebars is used for email notifications ([template-renderer.ts](file:///Users/edwards/git/egp-broker/server/services/email/template-renderer.ts)), but it compiles **static `.hbs` files from server storage**, not user-provided strings.
- **Prisma ORM:** There are no raw SQL queries (`$queryRaw` / `$executeRaw`), eliminating traditional SQL injection.

---

### 2. Relevant Penetration & Vulnerability Vectors to Monitor

Because this application acts as an **LTI 1.3 broker, proxy, and grade passback tool**, penetration testers and attackers would focus on the following domain-specific vectors:

#### A. XML External Entity (XXE) & SSRF in Grade Passback Proxy

- **The Vector:** The route `/api/proxy/grade-passback/**` handles LTI 1.1 / 1.3 XML outcomes with `requestSizeLimiter` and `xssValidator` disabled in `nuxt.config.ts`.
- **Risk:** If incoming XML payloads are ever parsed on the server with an insecure XML parser (with external entities enabled), attackers can trigger **XXE** (reading local files like `/etc/passwd` or cloud metadata). If the proxy forwards requests to arbitrary target URLs provided in the payload, attackers could attempt **Server-Side Request Forgery (SSRF)** against internal network resources (e.g., `169.254.169.254` or internal services).
- **Mitigation:** Ensure target proxy URLs are strictly validated against registered LMS/platform URLs in the database, and disable entity expansion (`noent: false` / `resolveEntities: false`) on any XML parsers.

#### B. LTI 1.3 Token Verification & Replay Attacks

- **The Vector:** LTI 1.3 launches rely on OpenID Connect (OIDC) JSON Web Tokens (JWTs) and JWKS public key endpoints.
- **Risk:**
  - **Forged Signatures / JWKS Spoofing:** If JWKS URLs are fetched dynamically from unverified incoming launch parameters rather than the pre-configured Platform record in the database, an attacker can supply their own keys.
  - **Replay Attacks:** If the `nonce` or `state` parameter is not strictly single-use and time-bound.
- **Mitigation:** Continue using `jose` with strict issuer (`iss`), audience (`aud`), and client ID checks tied to the verified database record.

#### C. Broken Object-Level Authorization (BOLA / IDOR)

- **The Vector:** Endpoints handling assignments, passes, and token redemptions (e.g., `/api/me/...`, `/api/assignments/...`).
- **Risk:** A student modifying parameter IDs (e.g., `assignmentId` or `passId`) to redeem passes or inspect assignments belonging to another student or another course.
- **Mitigation:** Enforce CASL ability rules and tenant scoping (`where: { userId: session.user.id, courseId: session.courseId }`) on every Prisma query.

#### D. Clickjacking & Iframe Embeddings

- **The Vector:** LTI applications must run embedded inside LMS iframes (Canvas, Blackboard, Moodle).
- **Configuration:** In `nuxt.config.ts`, `frame-ancestors: ['*']` and `xFrameOptions: false` are configured to permit LMS iframes.
- **Risk:** While necessary for LTI, allowing `*` means any malicious third-party site could embed the page in a hidden iframe to perform clickjacking.
- **Mitigation:** In production, restrict `frame-ancestors` to known LMS platform domains (or dynamically inject the launch origin if supported).

#### E. Cookie Security with Cross-Site Post-Backs (`SameSite=None`)

- **The Vector:** `auth.session.cookie` uses `sameSite: 'none'` and `partitioned: true` for cross-origin LMS launches.
- **Risk:** Cross-Site Request Forgery (CSRF) on non-LTI state-changing endpoints if session cookies are sent automatically.
- **Mitigation:** Ensure all non-LTI mutations require explicit CSRF tokens or custom headers (`X-Requested-With` / JSON Content-Type validation).

---

### Summary Checklist

| Attack Type                   | Susceptibility in this App       | Primary Defense in Place                                         |
| :---------------------------- | :------------------------------- | :--------------------------------------------------------------- |
| **Next.js RSC / Flight RCE**  | ❌ **None**                      | App uses Nuxt/Nitro; no RSC or flight deserialization.           |
| **Node.js Command Injection** | ❌ **None**                      | No shell execution or dynamic `eval`.                            |
| **SQL Injection**             | ❌ **None**                      | Parameterized Prisma ORM (no `$queryRaw`).                       |
| **SSRF (Proxy / LTI)**        | ⚠️ **Medium (Design dependent)** | Validate destination URLs strictly against registered platforms. |
| **XXE (XML Passback)**        | ⚠️ **Low / Medium**              | Use secure XML parsing (disable external DTDs/entities).         |
| **BOLA / IDOR**               | ⚠️ **Standard web risk**         | Enforce CASL and session-based query scoping.                    |
| **Clickjacking**              | ⚠️ **Acceptable tradeoff**       | Managed via CSP `frame-ancestors` tailored for LTI.              |
