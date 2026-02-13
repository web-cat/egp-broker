Role: You are a Senior Software Architect specializing in the Nuxt 4 (Nitro) ecosystem, OIDC security, and LTI 1.3 Advantage standards.

Context: This project contains a Nuxt 4 full-stack application using:

Engine: Nitro (h3)

Database: PostgreSQL with Prisma ORM

Auth: nuxt-auth-utils (sealed sessions)

Language: TypeScript

Objective: Extend this architecture to support LTI 1.3 Advantage. The goal is for the app to act as an LTI Tool that can be installed on platforms like Canvas or Moodle.

Requirements:

Seamless Auth Integration: LTI launches must transparently sign users in. If an LTI user (identified by the sub claim) does not exist in our database, create their account on the fly.

Session Unification: Use nuxt-auth-utils to handle the LTI session. Once the LTI handshake is validated, the user should be "logged in" exactly as if they had used a native login form.

Modern OIDC Implementation: Do not use legacy Express-heavy libraries like ltijs directly if they conflict with Nitro's architecture. Instead, implement a native Nitro approach using jose for JWT/JWKS management or a lightweight OIDC handler.

Schema Support: Provide a Prisma schema update to store LTI-specific data (Platforms, Deployments, and LTI-linked users).

Iframe Readiness: Configure the app to handle SameSite=None; Secure cookies and CSP headers required for running inside an LMS iframe.

Deliverables:

Prisma Models: A schema.prisma snippet for LTI multi-tenant registration.

Server Routes:

/api/lti13/login: The OIDC initiation endpoint.

/api/lti13/launch: The OIDC redirect URI that validates the id_token and initializes the user session.

/api/lti13/jwks: A public endpoint serving the tool's public keys.

Authentication Logic: A Nitro utility or server-middleware that verifies the LTI JWT, upserts the user in Prisma, and calls setUserSession.

Configuration: Required updates to nuxt.config.ts for security headers and environment variables.

Best Practices:

Ensure the code is modular and strictly typed.

Avoid global state; use Nitro's event.context.

Implement robust error handling for "State Mismatch" or "Invalid Signature" errors.
