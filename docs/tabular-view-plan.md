# Reusable Tabular View Strategy

A pattern for building dashboard table views on top of **Nuxt UI v4 `UTable`** (TanStack Table) with shared components for toolbar, pagination, empty/loading states, and row actions.

---

## Architecture

```
┌─ Page (e.g. app/pages/admin/courses.vue) ────────────────────────┐
│                                                                  │
│  Script: uses `useAdminCrud` composable for fetching & state     │
│                                                                  │
│  ┌─ <UiDataTable> (components/ui/data/DataTable.vue) ──────────┐ │
│  │  ┌─ Toolbar slot ─────────────────────────────────────────┐ │ │
│  │  │  <DataTableToolbar> (search input + slot for buttons)  │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │  ┌─ UTable ───────────────────────────────────────────────┐ │ │
│  │  │  columns defined by the page via prop                  │ │ │
│  │  │  row actions column via helper utils                   │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │  ┌─ Footer ───────────────────────────────────────────────┐ │ │
│  │  │  <DataTablePagination> (UPagination + row count)       │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ <EntityEditPanel> (e.g. AdminCourseEditPanel.vue) ─────────┐ │
│  │  Modal form for creating/editing items                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

Each page provides **only** what varies:
1. The `columns` definition array (using helpers)
2. The endpoint URL passed to `useAdminCrud`
3. The Edit/Create modal component
4. Optional toolbar buttons (e.g., "Add Entity")

Everything else — fetching, state management, filtering, pagination, loading skeleton, empty state — is handled by the shared `UiDataTable` wrapper and `useAdminCrud` composable.

---

## Key Utilities & Composables

### `app/composables/useAdminCrud.ts`

Encapsulates the standard data-fetching and state management logic for admin tables.

Arguments:
- `url`: The API endpoint (e.g., `/api/admin/courses`)
- `queryParams`: Optional object of reactive refs for filtering

Returns:
- `data`: The fetched array of items (reactive)
- `status`: Loading status ('idle', 'pending', 'success', 'error')
- `editOpen`: Boolean ref for modal visibility
- `editingItem`: Ref containing the item currently being edited (or null for creaetion)
- `tableKey`: Integer ref to force table re-render when needed
- `openCreate()`: Handler to open modal in "create" mode
- `openEdit(item)`: Handler to open modal in "edit" mode
- `onRowUpdated(id, updates)`: Handler to optimistically update a row
- `onItemCreated()`: Handler to refetch data after creation

### `app/utils/tableHelpers.ts`

Provides factory functions to create common table column definitions concisely.

- `countBadgeCell(key, color?)`: Renders a numeric value as a colored badge (or neutral if 0).
- `dateCellRenderer(key)`: Renders a date string using the standard `formatDate` utility.
- `actionsColumn(itemsFn)`: Renders the standard "..." dropdown menu. `itemsFn` receives the row context and returns the menu items array.

---

## Usage Pattern (example page)

A concrete example showing how an admin page uses `useAdminCrud` and `UiDataTable`:

```vue
<!-- app/pages/admin/courses.vue -->
<template>
  <div>
    <!-- Table Wrapper -->
    <UiDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="columns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search courses…"
      empty-icon="i-lucide-book-open"
      empty-text="No courses found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Course" @click="openCreate" />
      </template>
    </UiDataTable>

    <!-- Edit/Create Modal -->
    <AdminCourseEditPanel
      v-model:open="editOpen"
      :course="editingItem"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
// Import the shared row interface (defined in shared/models)
import type { CourseRow } from '@@/shared/models/course'

// 1. Setup Filters (optional)
const route = useRoute()
const deploymentFilter = computed(() => route.query.d as string | undefined)

// 2. Initialize CRUD State
const {
  data,
  status,
  editOpen,
  editingItem,
  tableKey,
  openCreate,
  openEdit,
  onRowUpdated,
  onItemCreated
} = useAdminCrud<CourseRow>('/api/admin/courses', {
  d: deploymentFilter
})

// 3. Define Columns using Helpers
const columns: TableColumn<CourseRow>[] = [
  {
    accessorKey: 'label',
    header: 'Code',
    cell: ({ row }) => row.getValue('label') || '—'
  },
  {
    accessorKey: 'enrollmentCount',
    header: 'Enrollments',
    cell: countBadgeCell('enrollmentCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  // 4. Actions Column
  actionsColumn<CourseRow>((row) => [
    [
      { label: 'View enrollments', icon: 'i-lucide-users' },
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>
```

---

## File Summary

| File | Type | Purpose |
|---|---|---|
| `app/components/ui/data/DataTable.vue` | **Component** | Auto-imported as `<UiDataTable>`. Generic table card. |
| `app/composables/useAdminCrud.ts` | **Composable** | Standardizes state management code. |
| `app/utils/tableHelpers.ts` | **Utility** | Standardizes column definitions. |

---

## Conventions for Adding New Tables

1. **Define a row interface** in `shared/models/`.
2. **Implement `useAdminCrud`** in your page component.
3. **Define columns** using `tableHelpers.ts` where possible.
4. **Use `<UiDataTable>`** to wrap the presentation.
5. **Create a separate EditPanel component** handling the form logic (creating/updating).
