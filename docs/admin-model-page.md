# Admin Model Page Standard

This document defines the standard pattern and the information required to generate a CRUD management page for a Prisma model in the admin dashboard.

---

## 1. Developer Input Required

The following decisions must be gathered from the developer before generating a page.

### Model Identity

| Question                      | Example                               |
| ----------------------------- | ------------------------------------- |
| Prisma model name?            | `Course`, `Assignment`, `LtiPlatform` |
| URL slug (kebab-case plural)? | `courses`, `assignments`, `platforms` |
| Sidebar icon (`i-lucide-*`)?  | `i-lucide-book-open`                  |
| Sidebar label?                | `Courses`                             |

### Page Title

By default, the page header shows the plural model name (e.g. "Courses"). If the page supports filtering via query parameters, the title can be contextual.

| Question                                 | Example                             |
| ---------------------------------------- | ----------------------------------- |
| Default title (plural model name)?       | `Assignments`                       |
| Dynamic title when filtered?             | `Assignments: CS 101 — Intro to CS` |
| Which filter triggers the dynamic title? | `?c=` (course code)                 |

### Table Columns

For each visible column, specify:

| Question                                | Example                                           |
| --------------------------------------- | ------------------------------------------------- |
| Accessor key (field name from API row)? | `label`, `enrollmentCount`                        |
| Column header label?                    | `Code`, `Enrollments`                             |
| Renderer type?                          | `text` (default), `date`, `countBadge`, or custom |
| Badge color (if countBadge)?            | `success` (default), `info`, `warning`            |

### Filtering

| Question                                                   | Example                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Query parameter name(s)?                                   | `?d=`, `?p=`, `?c=`                                        |
| What does each filter on?                                  | `d` → `deploymentId`, `c` → `course.label`                 |
| Is the filter a direct field match or a relational lookup? | Direct: `where.courseId`; Relational: `where.course.label` |

### Row Actions

| Question       | Example                             |
| -------------- | ----------------------------------- |
| Edit action?   | Always included (opens edit panel)  |
| Delete action? | Always included (styled as `error`) |

#### Relationship Navigation Actions

List the Prisma relations on the model below. For each relation the developer wants as a row action, specify the target admin page and how the filter parameter is derived from the current row:

| Relation Field | Include? | Target Page          | Filter Param | Row Value   |
| -------------- | -------- | -------------------- | ------------ | ----------- |
| `assignments`  | ✅       | `/admin/assignments` | `?c=`        | `row.label` |
| `enrollments`  | ✅       | `/admin/enrollments` | `?c=`        | `row.label` |
| `deployment`   | ❌       | —                    | —            | —           |

> **How to fill this out:** Run `grep -A2 'model {Model}' prisma/schema.prisma` to list relations. For each one-to-many or many-to-many relation, ask: "Should this appear as a 'View {related}' action in the row dropdown?" If yes, identify the target admin page (must already exist or be planned) and the query parameter + row field that links them.

### Edit Panel Fields

For each editable field, specify:

| Question                           | Example                            |
| ---------------------------------- | ---------------------------------- |
| Field key?                         | `title`, `dueDate`                 |
| Label?                             | `Title`, `Due Date`                |
| Input type?                        | `text` (default), `datetime-local` |
| Placeholder?                       | `e.g. Homework 1`, `Optional`      |
| Required?                          | Yes/No                             |
| Create-only? (hidden in edit mode) | Yes/No                             |
| Edit-only? (hidden in create mode) | Yes/No                             |

### API Behavior

| Question                                                      | Example                                |
| ------------------------------------------------------------- | -------------------------------------- |
| Fields that need auto-generation on create?                   | `resourceLinkId: manual-${Date.now()}` |
| Fields restricted to API-only updates? (never shown in panel) | `ltiContextId`                         |
| Date fields that need `String ↔ Date` conversion?            | `dueDate`, `availableFrom`             |
| Default sort order?                                           | `createdAt: 'desc'`                    |
| Related data to include?                                      | `course: { select: { label, title } }` |

---

## 2. Architecture

Each admin model page uses three shared modules plus five model-specific files.

### Shared Modules (already exist)

| Module                | Location                                                                                          | Purpose                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `useAdminCrud<T>()`   | [useAdminCrud.ts](file:///Users/edwards/git/egp-broker/app/composables/useAdminCrud.ts)           | CRUD state: data fetching, edit panel toggle, in-place row updates, full refetch on create |
| `useAdminPageTitle()` | [useAdminPageTitle.ts](file:///Users/edwards/git/egp-broker/app/composables/useAdminPageTitle.ts) | Lets child pages override the admin layout header title; auto-resets on unmount            |
| Table helpers         | [tableHelpers.ts](file:///Users/edwards/git/egp-broker/app/utils/tableHelpers.ts)                 | `countBadgeCell()`, `actionsColumn()`, `dateCellRenderer()`                                |
| Date formatting       | [date.ts](file:///Users/edwards/git/egp-broker/app/utils/date.ts)                                 | Locale-aware `formatDate()` (auto-imported)                                                |

### Model-Specific Files (to create)

#### A. Page — `app/pages/admin/{slug}.vue`

```vue
<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="columns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search {models}…"
      empty-icon="{icon}"
      empty-text="No {models} found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add {Model}" @click="openCreate" />
      </template>
    </UiDataTable>

    <Admin{Model}EditPanel
      v-model:open="editOpen"
      :{model}="editingItem"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface {Model}Row { /* ... */ }

const { data, status, editOpen, editingItem, tableKey,
        openCreate, openEdit, onRowUpdated, onItemCreated
} = useAdminCrud<{Model}Row>('/api/admin/{slug}', { /* query params */ })

// --- Page title (always set; dynamic if filtered) ---
const { setTitle } = useAdminPageTitle()
setTitle('{Models}')  // default: plural model name

const columns: TableColumn<{Model}Row>[] = [
  // Column definitions using countBadgeCell(), dateCellRenderer(), actionsColumn()
]
</script>
```

#### B. Edit Panel — `app/components/admin/{Model}EditPanel.vue`

- `USlideover` with `UForm`.
- Dual mode: **Create** (prop is `null`) / **Edit** (prop is provided).
- Emits `saved` (id + updates) and `created`.
- Watches `[prop, open]` to sync/reset form state.

#### C. List API — `server/api/admin/{slug}.get.ts`

- Validates `session.user.globalRole === 'ADMIN'`.
- Parses optional filter query parameters via `getQuery(event)`.
- Returns `ApiResponse<{Model}Row[]>`.
- Maps Prisma results to flat row objects (resolving relations, converting dates to ISO strings).

#### D. Create API — `server/api/admin/{slug}.post.ts`

- Validates ADMIN role.
- Zod schema for request body.
- Handles auto-generated fields (e.g., `resourceLinkId`).
- Returns `ApiResponse` with status `201`.

#### E. Update API — `server/api/admin/{slug}/[id].patch.ts`

- Validates ADMIN role.
- Zod schema using `.nullable().optional()` for all fields (partial updates).
- Handles date `String → Date` conversions with null-clearing support.
- Returns `ApiResponse` with status `200`.

---

## 3. Implementation Checklist

1. **Shared Model:**
   - [ ] `shared/models/{model}.ts` — Zod schemas, inferred types, initial state
2. **API Layer:**
   - [ ] `server/api/admin/{slug}.get.ts` — list endpoint with filtering
   - [ ] `server/api/admin/{slug}.post.ts` — create endpoint (imports schema from shared model)
   - [ ] `server/api/admin/{slug}/[id].patch.ts` — update endpoint (imports schema from shared model)
3. **Component Layer:**
   - [ ] `app/components/admin/{Model}EditPanel.vue` — dual-mode panel
4. **Page Layer:**
   - [ ] `app/pages/admin/{slug}.vue` — table + panel using `useAdminCrud` + `useAdminPageTitle`
5. **Navigation:**
   - [ ] Add entry to `adminLinks` in [admin.vue](file:///Users/edwards/git/egp-broker/app/pages/admin.vue)
