# Admin Model Page Standard

This document outlines the standard pattern for creating a management page for a new database model within the admin dashboard.

## 1. Information Required from the User

Before generating a new admin model page, the following information should be clarified:

- **Target Model:** The Prisma model name (e.g., `LtiPlatform`, `User`).
- **Listing Requirements:**
  - Which fields should be visible in the table?
  - Any calculated fields (e.g., related counts)?
  - Primary sort order.
- **Filtering Requirements:**
  - Any query parameters for filtering (e.g., `?p=` for platform ID)?
  - Relationship joins needed for filtering.
- **Editing Requirements:**
  - Which fields are editable?
  - Are any fields required only at creation?
  - Are any fields restricted to API-only updates?
- **Row Actions:**
  - Primary actions (Edit, View Details, Delete).
  - Navigation links (e.g., "View related courses").

---

## 2. Page Architecture

A standard admin model page consists of five core components:

### A. The Page Component (`app/pages/admin/[model].vue`)

- Uses `UiDataTable` with a reactive `:key="tableKey"`.
- Fetches data using `useFetch` with `lazy: true` and reactive query params.
- Manages `editOpen` and `editingItem` state.
- Implements `onRowUpdated` (in-place array patch) and `onItemCreated` (full refetch).

### B. The Edit Panel (`app/components/admin/[Model]EditPanel.vue`)

- Uses `USlideover` and `UForm`.
- Supports dual mode: **Create** (if `item` is null) and **Edit** (if `item` is provided).
- Handles local state management and API submissions.
- Emits `saved` (with updates) and `created` events.

### C. List API (`server/api/admin/[model].get.ts`)

- Validates ADMIN role.
- Parses optional filter query parameters.
- Returns a flat `ApiResponse` structure suitable for the table.

### D. Create API (`server/api/admin/[model].post.ts`)

- Validates ADMIN role.
- Uses Zod for request body validation.
- Handles ID generation or specific defaults.

### E. Update API (`server/api/admin/[model]/[id].patch.ts`)

- Validates ADMIN role.
- Uses Zod with `.nullable().optional()` for partial updates.
- Performs the Prisma update.

---

## 3. Implementation Plan Template

1. **API Layer:**
   - Create the `GET` endpoint with filtering logic.
   - Create the `POST` endpoint with Zod validation.
   - Create the `PATCH` endpoint with Zod validation.
2. **Component Layer:**
   - Create the `[Model]EditPanel.vue` component.
   - Implement mode switching (Title, Button labels, fields).
   - Implement date/type transformations if needed.
3. **Page Layer:**
   - Create `app/pages/admin/[model].vue`.
   - Define table columns and row actions.
   - Wire the Create/Edit panel events.
4. **Navigation:**
   - Add the new page to the `adminLinks` array in `app/pages/admin.vue`.

---

## 4. Key Reactivity Note

To ensure the table updates reliably without a full page reload or heavy flickering, follow this pattern:

1. Bind `:key="tableKey"` to `UiDataTable`.
2. When an item is updated, patch the local `data` array reference and increment `tableKey`.
3. When an item is created, perform a background `$fetch` to refresh the data and increment `tableKey`.
