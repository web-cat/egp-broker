# Understand EGP Broker

This document outlines how to use the **Understand Anything** tool suite to analyze this codebase, explains the identified **Architectural Layers**, and details the **10-Step Guided Learning Tour** designed for newcomers to the project.

---

## 🛠️ How to Use the Understand-Anything Skills

The **Understand Anything** suite provides two main commands for autonomous codebase mapping and interactive exploration:

### 1. `/understand` — Generate the Knowledge Graph

This command runs a comprehensive, multi-phase static analysis of the codebase to extract its structure and build a semantic graph.

- **What it does:**
  - Walks the file tree (respecting `.understandignore` and `.gitignore`).
  - Determines file categories (code, config, docs, infra, schema, etc.).
  - Extracts internal imports and dependencies using tree-sitter parsers.
  - Computes cohesive communities using the Louvain clustering algorithm.
  - Identifies architectural layers and builds a sequential pedagogical learning tour.
- **Result:** Outputs the complete graph to `.understand-anything/knowledge-graph.json`.
- **Subsequent Runs:** Running `/understand` again will automatically perform a fast **incremental update**, analyzing only files that have changed since the last git commit.

### 2. `/understand-dashboard` — Launch the Interactive Visualizer

Starts a local web-based dashboard showing the generated graph visually.

- **Launch Command:**
  - Vite will boot a local dev server and output a tokenized URL, such as:
    `http://127.0.0.1:5173/?token=<access-token>`
- **Features:**
  - **Visual Graph Explorer:** Render node-edge topologies of your code structure.
  - **Layer Filter:** Isolates specific layers (e.g., API Layer, Data Layer) to inspect relationships.
  - **Interactive Guided Tour:** Steps you sequentially through the files with educational guides.

---

## 🏛️ Identified Architectural Layers

The static analyzer grouped the files into **9 distinct layers** matching Nuxt 4 and server-side microservice patterns:

| Layer ID               | Layer Name                     | Responsibility                                                               | Key Directories / Files                                               |
| :--------------------- | :----------------------------- | :--------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `layer:ui`             | **Frontend UI Layer**          | Vue presentation pages, layouts, and reusable component atoms.               | `app/components/`, `app/layouts/`, `app/pages/`, `app/app.vue`        |
| `layer:frontend-logic` | **Frontend Logic & State**     | Client-side composables, Pinia state stores, and Vue plugins.                | `app/composables/`, `app/stores/`, `app/plugins/`                     |
| `layer:api`            | **Server API Handlers**        | Server-side endpoints, custom routes, and Swagger specs.                     | `server/api/`, `server/routes/`, `lib/swagger.ts`                     |
| `layer:service`        | **Server Services & Logic**    | Core business logic, LTI proxies, token managers, and tasks.                 | `server/services/`, `server/utils/`, `server/tasks/`, `lib/prisma.ts` |
| `layer:data`           | **Data Models & Schemas**      | Relational schemas, seed scripts, and Zod validator boundary configurations. | `prisma/schema.prisma`, `prisma/seed.ts`, `shared/models/`            |
| `layer:types`          | **Shared Constants & Helpers** | Universal types, custom authorization abilities, and i18n locales.           | `shared/types/`, `shared/constants/`, `shared/utils/`, `i18n/`        |
| `layer:infrastructure` | **Infrastructure & Build**     | Docker container setups, shell scripts, and bundler configurations.          | `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `.husky/`   |
| `layer:documentation`  | **Documentation & Specs**      | Architecture specs, structural design documents, and manuals.                | `README.md`, `GEMINI.md`, `PROJECT_RULES.md`, `docs/`                 |
| `layer:test`           | **Verification & Tests**       | Vitest unit tests and Playwright E2E integration test suites.                | `test/`, `playwright/`                                                |

---

## 🗺️ The 10-Step Guided Learning Tour

A sequential, pedagogical path designed to take a developer from high-level understanding to deep backend logic:

### 1. Project Overview

- **Nodes:** [README.md](file:///Users/edwards/git/egp-broker/README.md)
- **Focus:** Understand EGP Broker's core mission: bridging the gap between Learning Management Systems (LMS like Canvas) and external tools through resubmission tokens and LTI proxies.

### 2. Relational Database Schema

- **Nodes:** [prisma/schema.prisma](file:///Users/edwards/git/egp-broker/prisma/schema.prisma)
- **Focus:** Study the database models (User, Course, Enrollment, Assignment, PassType, StudentPassPool, and PassRedemption) managing token balances and tracking extension receipts.
- _Language Lesson:_ Prisma schemas define database tables and relations cleanly, providing a single source of truth for the database layout.

### 3. Global Database Connection Singleton

- **Nodes:** [lib/prisma.ts](file:///Users/edwards/git/egp-broker/lib/prisma.ts)
- **Focus:** Understand how the PrismaClient singleton is instantiated and kept persistent across Hot Module Replacement (HMR) development cycles to avoid connection pool leaks.

### 4. Zod Schema Validations

- **Nodes:** [shared/models/user.ts](file:///Users/edwards/git/egp-broker/shared/models/user.ts), [shared/models/pass.ts](file:///Users/edwards/git/egp-broker/shared/models/pass.ts)
- **Focus:** Learn how Zod validation schemas sanitise payloads on both client and server boundaries, enforcing safe, type-safe operations.

### 5. Nitro Server Bootstrapper

- **Nodes:** [server/plugins/startup-checks.ts](file:///Users/edwards/git/egp-broker/server/plugins/startup-checks.ts)
- **Focus:** Explore how Nitro server plugins run at launch to perform essential startup validation gates (such as confirming SMTP mailer credentials) before accepting HTTP connections.

### 6. OIDC & LTI Launch Handshake

- **Nodes:** [server/utils/lti.ts](file:///Users/edwards/git/egp-broker/server/utils/lti.ts), [server/utils/lti-launch.ts](file:///Users/edwards/git/egp-broker/server/utils/lti-launch.ts)
- **Focus:** Understand the certified LTI 1.3 Advantage launch sequence: Third-party OIDC initiates, platform redirects payloads, and asymmetric JWKS signatures are verified securely.

### 7. Token Balance & Extension Managers

- **Nodes:** [server/utils/redemptions.ts](file:///Users/edwards/git/egp-broker/server/utils/redemptions.ts), [server/utils/assignments.ts](file:///Users/edwards/git/egp-broker/server/utils/assignments.ts)
- **Focus:** Deep dive into the core business algorithms deducting student passes, verifying cooldown periods, and communicating extensions to the target LMS gradebook.

### 8. Nitro API Endpoint Controllers

- **Nodes:** [server/api/me/redemptions/index.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/redemptions/index.post.ts), [server/api/proxy/grade-passback/lti13.post.ts](file:///Users/edwards/git/egp-broker/server/api/proxy/grade-passback/lti13.post.ts)
- **Focus:** Analyze endpoint routing logic, controller Zod validation wrappers, and the direct handoff of parsed payloads to backend logic layers.

### 9. Nuxt UI Presentational Shell

- **Nodes:** [app/app.vue](file:///Users/edwards/git/egp-broker/app/app.vue), [app/layouts/default.vue](file:///Users/edwards/git/egp-broker/app/layouts/default.vue)
- **Focus:** Learn the client-side SPA presentational shell, layouts, reactive component structures, state managers, and internationalization plugins.

### 10. Containerization & Orchestration

- **Nodes:** [Dockerfile](file:///Users/edwards/git/egp-broker/Dockerfile), [docker-compose.yml](file:///Users/edwards/git/egp-broker/docker-compose.yml)
- **Focus:** Study the microservices stack including PostgreSQL data storage, Adminer web-based administration, and Playwright sandboxed testing configurations.
- _Language Lesson:_ Multi-stage Docker builds isolate the compile layer from production, reducing the final image size by 50–80% and mitigating attack surface vectors.
