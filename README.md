# EGP Broker

The EGP Broker is an innovative intermediary tool designed to facilitate the adoption of Equitable Grading Practices (EGP) in modern educational environments. Traditional grading systems, which often rely on points-based, weighted-average models, can inadvertently contribute to systemic inequity and fail to capture the nuances of student mastery. By shifting the focus from point accumulation to demonstrable learning outcomes, EGP models—such as specifications grading and mastery grading—promote higher engagement and ensure all students have access to the same opportunities through flexible deadlines and work resubmission.

Acting as a specialized LTI proxy and universal translation layer, the EGP Broker bridges the critical technological gap between external assessment tools (like OpenDSA or Gradescope) and rigid Learning Management Systems (LMS) such as Canvas or Moodle. Because current LTI standards mandate the passback of single, normalized numerical scores, instructors are often forced to manually "flatten" rich categorical feedback into simplified numbers. The broker intercepts this complex data, applies instructor-defined logic to translate it into an LTI-compliant format, and securely updates the LMS gradebook, effectively decoupling pedagogical goals from the limitations of the existing technology stack.

Built on a robust Node.js architecture, the system supports both LTI 1.3 and legacy LTI 1.1 protocols through a modular and extensible design. The broker is designed for institutional self-hosting, ensuring that sensitive educational records remain within the university's control for full data privacy and FERPA compliance. By automating the grade transfer process and providing a centralized point of configuration for grading rules across a curriculum, the EGP Broker transforms alternative grading from a high-effort manual task into a sustainable, scalable practice that can be implemented across diverse academic departments.

## Managing Resubmission Tokens and Extensions

The "Free Pass" system is a core feature of the EGP Broker, designed to replace traditional punitive late policies with a structured, mastery-oriented approach to deadline flexibility. Instead of automatically losing points for late submissions, students are provided with a limited pool of resubmission tokens—often referred to as "free passes"—that they can use throughout the semester. This approach shifts the pedagogical focus from penalizing delays to incentivizing persistence and mastery, allowing students to re-engage with material when they are best prepared to demonstrate their learning.

Research into this model indicates that providing structured flexibility through resubmission tokens fosters a more resilient learning environment and significantly improves student outcomes across key metrics such as retention, assignment completion, and overall performance. By allowing students to re-open assignments for a specific window of time, the system encourages self-regulated learning and reduces the anxiety associated with rigid deadlines. Furthermore, it promotes equity by formalizing the process for requesting extensions, ensuring that all students have transparent and equal access to support rather than relying on informal "shadow policies."

A significant barrier to adopting token-based systems in large courses is the administrative burden of tracking usage across multiple platforms and manually updating deadlines. The EGP Broker solves this by providing automated management of resubmission tokens. It tracks each student's token balance, intercepts resubmission requests, and automatically communicates with the LMS to record individual assignment deadline extensions. This automation makes complex, equitable grading practices sustainable and scalable, allowing instructors to focus on providing high-quality feedback rather than managing administrative overhead.

## 🐳 Docker-based Development

This project is designed to be developed and executed entirely within Docker. By containerizing the development environment, we ensure that every developer works in a uniform environment (Node 22, pnpm, system dependencies) regardless of their host OS.

### Multi-stage Docker Architecture

The `Dockerfile` uses a multi-stage build process to optimize for both speed and portability:

- **`development` target**: Optimized for a fast developer loop. This stage installs dependencies but does **not** copy the source code into the image. Instead, it expects the project directory to be mounted at `/app` at runtime, enabling Hot Module Replacement (HMR) and instant feedback.
- **`production` target**: Generates a self-contained, minimized image. It builds the Nuxt application and copies only the necessary production artifacts to keep the image size small and secure.

### Getting Started

1. **Initialize Environment**

   ```bash
   cp .env.example .env
   ```

   Configure your secrets in `.env`. Shared non-secret variables are already configured in `.env.common`. Values set in `.env` will override those in `.env.common`.
2. **Launch the Development Stack**

   ```bash
   docker compose up
   ```

   This command builds the development image, starts the PostgreSQL database and Adminer (DB UI), and launches the Nuxt development server. You can use `-d` if desired, or run this in one terminal window and watch the log, while developing in one or more other terminal windows.

   The development version of the app will be accessible at **http://localhost:3000**.

   The [Adminer](https://adminer.org/) application for directly managing the
   database will be accessible at **http://localhost:8080**. The login info and
   database access info can be found in `.env.common`.
3. **Synchronization**
   The first time you start the container, `docker compose` will run the `postinstall` script (Prisma generation and Nuxt preparation) automatically at startup. Scripts
   are defined in `package.json` and summarized below.

### Interactive Development

Since the environment is fully containerized, you should run all development commands (like adding packages or running migrations) **inside** the container to ensure consistency.

- **Open an Interactive Terminal**:
  ```bash
  # While the application stack is running, e.g., after docker compose up
  docker compose exec app-dev bash
  ```
- **Run Commands Directly**:
  ```bash
  docker compose exec app-dev pnpm install <package>
  docker compose exec app-dev pnpm prisma migrate dev
  docker compose exec app-dev pnpm test
  ```

### Production Simulation

To verify the production build locally before deployment:

```bash
docker compose --profile production up -d app-prod
```

The production version will be accessible at **http://localhost:8081**.

### Git Conventional Commits

The project uses Husky hooks to lint the code (and fix any issues) prior to any git commit. This is done inside the development docker image, so be sure to have the
application stack running (so the app-dev container is available) when committing.

The Husky hooks also use commitlint to double-check your commit messages against the conventional commits specification. See https://www.conventionalcommits.org/en/v1.0.0/
for full details. The basics: be sure each commit starts with a type prefix (e.g. "fix: ", "feat: ", "chore: ", "docs: ", "style: ", "refactor: ", "test: ", "perf: ", "ci: ", "build: ", "release: ", "workflow: ", "revert: "). Be sure to include both the colon and
the following space. Optionally, you can add a scope (e.g. "(lti)", "(ui)", etc.)
between the type and the colon to specify which part of the application your changes
affect.

### 🛠️ Key Commands

| Command                                             | Description                       |
| :-------------------------------------------------- | :-------------------------------- |
| `docker compose up -d app-dev`                    | Start the development environment |
| `docker compose exec app-dev bash`                | Open a shell in the dev container |
| `docker compose stop`                             | Stop all services                 |
| `docker compose logs -f app-dev`                  | View real-time application logs   |
| `docker compose --profile production up app-prod` | Test the production build         |

### Resetting After Big Changes

Sometimes when developing, you may make changes that are big enough you need to "reset" the app, the database, or whatever. This can be particularly true when merging in changes from other branches where there have been significant changes to data models. Here are some commands to consider and what they are for.

* `scripts/restart-app.sh`: Uses `docker compose exec` to kill the application and restart it within the container, without forcing you to kill the entire stack and restart it.
* `docker compose exec app-dev pnpm prisma migrate reset`: Perform a "hard reset" on the database by completely dropping and recreating all tables and re-seeding the database with its initial dev contents (see `prisma/seed.ts`).
* Restart the whole stack: If you are running the stack interactively using `docker compose up`, just use Ctrl-C to terminate the whole stack. If you are running in detached mode, use `docker compose down`.
* Rebuild the docker image: This isn't needed very often, but if there are significant changes to any application dependencies, it might be needed. Shut down the application stack if it is running and use `docker compose build app-dev` to rebuild the docker image.

### 📜 Script Reference

The following scripts are available in `package.json` and can be executed using `pnpm <script-name>` within the development image (or use `docker compose exec app-dev pnpm <script-name>`, or `run` instead of `exec` if the image isn't already running).

| Script                    | Command               | Description                                                           |
| :------------------------ | :-------------------- | :-------------------------------------------------------------------- |
| **`dev`**         | `nuxt dev`          | Starts the development server with Hot Module Replacement (HMR).      |
| **`build`**       | `nuxt build`        | Compiles the application for production. Output is in `.output/`.   |
| **`preview`**     | `nuxt preview`      | Locally boots the production build for testing.                       |
| **`lint`**        | `run lint:*`        | Runs both ESLint and Prettier to ensure code quality.                 |
| **`test`**        | `run test:*`        | Runs the full test suite (Unit + E2E).                                |
| **`test:unit`**   | `vitest run`        | Runs unit tests once. Use `:watch` for TDD mode.                    |
| **`test:e2e`**    | `playwright test`   | Runs end-to-end tests. Use `:ui` for the interactive runner.        |
| **`db:generate`** | `prisma generate`   | Generates the Prisma Client based on your schema.                     |
| **`db:push`**     | `prisma db push`    | Syncs schema to the DB without creating a migration file.             |
| **`db:seed`**     | `prisma db seed`    | populates the database with initial/test data.                        |
| **`postinstall`** | `db:gen && prepare` | Automatically runs after `pnpm install` to set up your environment. |
| **`changelog`**   | `git-cliff`         | Generates a `CHANGELOG.md` based on conventional commits.           |
| **`release:*`**   | `pnpm version`      | Increments version (patch/minor/major) and pushes tags.               |

---

## 🎓 LTI 1.3 Advantage

The EGP Broker is a certified LTI 1.3 Tool. It implements the OIDC Third-party Login flow and handles LTI launches directly within the Nitro (Nuxt 4) architecture.

### Server-Side Endpoints

- **`GET /api/lti13/login`**: OIDC Initiation endpoint. This is the entry point for the LMS when a user clicks the tool link. It handles the initial handshake and redirects back to the LMS for authentication.
- **`POST /api/lti13/launch`**: OIDC Redirect URI. This endpoint receives the `id_token` from the LMS, validates its signature using the platform's JWKS, links or creates the local user account, and initializes a secure session.
- **`GET /api/lti13/jwks`**: Public JWKS (JSON Web Key Set). Serves the tool's public keys, allowing platforms to verify any signed messages sent by the broker.

### Configuration

LTI 1.3 security relies on RSA key pairs. You must configure the tool's private key in your `.env` file:

- **`NUXT_LTI_PRIVATE_KEY`**: The tool's private key in **PKCS8** format.
- **`NUXT_LTI_KEY_ID`**: A unique identifier for the key (e.g., `lti-key-1`), which will be presented in the JWKS.

> [!TIP]
> You can generate a compatible key pair using OpenSSL:
>
> ```bash
> openssl genrsa -out private.pem 2048
> openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private_pkcs8.pem
> ```

### Canvas Installation Instructions

To install the EGP Broker in Canvas, follow these steps in the Developer Keys section of your Canvas instance:

1. **Method**: Manual Entry
2. **Title**: EGP Broker
3. **Target Link URI**: `https://your-domain.com/`
4. **OpenID Connect Initiation URL**: `https://your-domain.com/api/lti13/login`
5. **Redirect URIs**: `https://your-domain.com/api/lti13/launch`
6. **JWK Method**: Public JWK URL
7. **Public JWK URL**: `https://your-domain.com/api/lti13/jwks`
8. **LTI Advantage Services**: Enable "Assignment Data Service", "Result Service", and "Deep Linking Support" as needed for your use case.

Once the Developer Key is created, perform the registration in the EGP Broker database (adding an `LtiPlatform` record) using the Client ID and Issuer (`https://canvas.instructure.com`) provided by Canvas.

---

## Previous Generation README

The first version of the README for this project includes many details about
the LTI interface and older/outdated information about setup for connection
with Canvas. You can find it in the `sakethrajesh-main-free-passes` branch on github:
https://github.com/web-cat/egp-broker/blob/sakethrajesh-main-free-passes/README.md.

---

## ⚡ Nuxt Boilerplate Starter Code

This project is based on the [nuxt-boilerplat](https://github.com/WilliamFontaine/nuxt-boilerplate) project. See that project for more details on the basic
project structure and common tools. A snapshot of the original starter is
available in the `nuxt-boilerplate` branch of this repository.

The following information summarizes what this project inherits from
`nuxt-boilerplate` and comes from that project's README.

### 🚀 Features

- **🔧 Nuxt 4** with Vue 3 Composition API and TypeScript
- **🎨 Nuxt UI** components with Tailwind CSS
- **🔐 Authentication** with JWT sessions, bcrypt password hashing, and email verification
- **🗄️ Prisma ORM** with PostgreSQL
- **🌍 Internationalization** (French/English) with auto-detection
- **🛡️ Security** hardening (CORS, CSP, rate limiting)
- **🧪 Testing** with Vitest (unit) and Playwright (E2E)
- **✨ Code Quality** with ESLint, Prettier, and conventional commits
- **🗂️ State Management** with Pinia and cookie persistence

## 📁 Project Structure

```
├── app/                      # Nuxt application
│   ├── components/           # Vue components (auto-imported)
│   ├── composables/          # Form composables, utilities
│   ├── pages/                # File-based routing
│   └── layouts/              # Layout components
├── shared/                   # Shared utilities (auto-imported)
│   ├── models/               # Zod schemas and type definitions
│   ├── types/                # API and shared types
│   └── utils/                # Utility functions
├── server/                   # Server-side code
│   ├── api/                  # API routes (auto-mapped)
│   ├── services/             # Business logic services
│   └── middleware/           # Server middleware
├── prisma/                   # Database schema and migrations
└── test/                     # Unit and E2E tests
```

## 🔧 Tech Stack

- **Frontend**: Nuxt 4, Vue 3, TypeScript, Nuxt UI, Tailwind CSS
- **Backend**: Nitro, H3, PostgreSQL, Prisma ORM
- **Auth**: JWT sessions, bcrypt, email verification, rate limiting
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Quality**: ESLint, Prettier, Husky hooks

## 📚 Documentation

Detailed implementation guides in https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs:

### 🎯 Implementation Patterns

- **[Form Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/form-patterns.md)** - Form composables and validation
- **[Component Architecture](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/component-architecture.md)** - Vue component patterns
- **[Database Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/database-patterns.md)** - Prisma usage and optimization
- **[Security Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/security-patterns.md)** - Authentication, HTTPS/HTTP security, CORS
- **[Testing Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/testing-patterns.md)** - Unit and E2E testing strategies
- **[Pinia Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/pinia-patterns.md)** - State management with persistence
- **[Notification System](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/notification-system.md)** - Toast system and notifications

### 🌟 System Features

- **[Email System](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/email-system.md)** - Handlebars templates and automated delivery
- **[Internationalization](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/internationalization.md)** - Multi-language support
- **[SEO Patterns](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/seo-patterns.md)** - SEO optimization and social media
- **[Auto-imports Configuration](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/auto-imports.md)** - Optimized auto-imports setup

### 🚀 Operations

- **[API Documentation](https://github.com/WilliamFontaine/nuxt-boilerplate/tree/main/docs/api.md)** - Auto-generated API documentation
