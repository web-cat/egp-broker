# Nuxt 4 Project Architecture: The Developer’s Guide

Welcome to the team! This guide will walk you through our architectural standards for this application. Our goal is to maintain a system where design decisions are isolated, preventing "sweeping effects" that occur when business logic is implicitly coupled to the UI.

---

## 🏛️ The Three Pillars of Our Architecture

To keep the codebase clean, we follow three strict rules:

1. **Single Source of Truth (SSoT):** Every validation rule or data structure lives in exactly one place.
2. **Layered Sovereignty:** Data flows down, events flow up. The server never trusts the client.
3. **Explicit Transport:** Components never know your API URLs; they only know the "Features" they provide.

---

## 🗺️ Step-by-Step: Where to Put Your Code

When building a new feature (e.g., a "Course Assignment" list), follow this specific sequence:

### Step 1: Define the Shared Contract (`/shared`)

Before writing any UI or API logic, define the **Data Truth**.

- **Location:** `shared/models/assignment.ts`
- **What goes here:** Zod schemas and TypeScript types that describe what an assignment looks like.
- **Principle:** This ensures both the frontend and backend are perfectly in sync.

### Step 2: Build the Data Provider & Business Logic (`/server`)

Now, implement the business logic and create the API endpoint.

- **Location:** `server/utils/assignments.ts` (Logic) and `server/api/assignments.get.ts` (Endpoint).
- **What goes here:**
  - **Utils:** Core business logic (grading, permissions) and complex DB queries.
  - **API:** Input validation, authentication checks, and calling your utils.
- **Crucial Rule:** Use Prisma's `select` to project only the fields defined in your Shared Contract. Never return the raw database model.

### Step 3: Abstract the Transport (`/app/composables/features`)

Create a "Feature Composable" to hide the network logic from the UI.

- **Location:** `app/composables/features/useAssignments.ts`
- **What goes here:** A function that uses `useFetch` to call your API.
- **Principle:** If we change the API version or URL, we only change it here—never in the components.

### Step 4: Create the Presenter (`/app/components/base`)

Build the visual "Atom" for the assignment.

- **Location:** `app/components/base/BaseAssignmentCard.vue`
- **What goes here:** HTML and CSS. It takes data via `props` and sends actions via `emits`.
- **Restriction:** **No** imports from Pinia or APIs. This must be a "pure" UI component.

### Step 5: The Orchestrator (`/app/components/features`)

Finally, connect everything together.

- **Location:** `app/components/features/AssignmentList.vue`
- **What goes here:** Import your `useAssignments` composable and loop through your `BaseAssignmentCard` components.
- **Principle:** This is the only place where UI meets Business Logic.

---

## 🐳 Development Workflow

We work exclusively inside Docker to ensure environment parity.

1. **Start the environment:** `docker compose up`.
2. **Database changes:** Never use `db push`. Generate a migration:
   `docker compose exec app-dev pnpm prisma migrate dev --name <description>`.
3. **Testing:** Run unit tests inside the container before committing:
   `docker compose exec app-dev pnpm test`.

---

## 📋 The "Definition of Done" Checklist

Before submitting a Pull Request, ask yourself:

- [ ] Did I avoid using `any`? (Use `unknown` + Type Guards instead).
- [ ] Is my business logic isolated in a Composable or Server Util?.
- [ ] Does my "Base" component have zero knowledge of the API?.
- [ ] Did I include `createdAt` and `updatedAt` in my new Prisma model?.

---

## 🔍 The "Reuse First" Workflow

Before writing a single line of new code, you must audit the existing infrastructure. Building from scratch is our last resort; extending or reusing existing "contracts" ensures consistency and reduces technical debt.

### 1. Audit the Shared Contracts (`/shared`)

- **Action:** Search `shared/models/` for existing Zod objects that represent the data entity you are working with.
- **Decision:**
- **Reuse:** If the existing schema covers 80% of your needs, use it.
- **Extend:** If you need specific extra fields for a new view, use `.extend()` on the existing Zod schema to create a "Projection".
- **New:** Create a new schema only if the entity represents a fundamentally different business domain.

### 2. Audit API Providers & Utils (`/server`)

- **Action:** Check `server/utils/` and `server/api/` for existing database helpers or endpoints that interact with your target Prisma model.
- **Decision:**
- **Reuse:** If an endpoint exists but returns more data than you need, it is often better to reuse it than to create a redundant route.
- **Extend:** Modify an existing `select` statement in a server utility if it benefits multiple features without leaking sensitive data.

### 3. Audit Feature Composables (`/app/composables/features`)

- **Action:** Look for composables that already handle the "Transport" for your data.
- **Decision:**
- **Reuse:** If `useUserAccount` already fetches the profile, do not create `useSettingsProfile`.
- **Extend:** Add a new method to an existing feature composable if the logic is related to the same domain entity.

### 4. Audit Base Components (`/app/components/base`)

- **Action:** Browse the "Atom" library for generic UI elements.
- **Decision:**
- **Reuse:** Always use `BaseButton` or `BaseInput`. Never write raw `<button>` or `<input>` tags.
- **Extend:** Add a new `prop` or `slot` to a Base component if it remains generic and stateless.

---

## 🗺️ Step-by-Step: Where to Put New Code

If your audit proves that a new piece is necessary, follow this sequence:

### Step 1: Define the Shared Contract (`/shared`)

- **What:** Define the **Data Truth** using Zod.
- **Why:** This acts as the contract that both the App and Server must follow.

### Step 2: Build the Data Provider & Business Logic (`/server`)

- **What:** Create the business logic in `server/utils/` and the API endpoint in `server/api/`.
- **Crucial Rule:** Use Prisma's `select` to project only the fields defined in your Shared Contract. Never return the raw database model.

### Step 3: Abstract the Transport (`/app/composables/features`)

- **What:** Create a composable to hide network logic (URLs/methods) from the UI.
- **Why:** If the API version changes, you only update this one file.

### Step 4: The Orchestrator (`/app/components/features`)

- **What:** Create the "Feature" component that imports your composable and manages state (loading, errors, success).
- **Why:** This is the only place where UI meets Business Logic.

### Step 5: The Presenter (`/app/components/base`)

- **What:** Build or use a "pure" UI atom that takes data via `props` and sends actions via `emits`.
- **Restriction:** **No** imports from Pinia or APIs are allowed here.

---

## 🐳 Development Workflow

- **Docker:** Always run `docker compose up`. All commands (pnpm, prisma, test) must run inside the `app-dev` container.
- **Migrations:** Never use `db push`. Use `prisma migrate dev` to maintain a trackable history.
- **Testing:** Unit tests for Base components and Shared schemas are mandatory before submission.

---

## 📋 The "Definition of Done" Checklist

- [ ] Did I check if an existing Shared Model could be extended?

* [ ] Is my new component classified as "Base" (stateless) or "Feature" (stateful)?
* [ ] Did I avoid using `any` and use `z.infer` for types instead?
* [ ] Does my API return a projected interface rather than the full Prisma model?

**Ready to start? Would you like me to analyze a specific feature request and tell you which existing components you should reuse?**
