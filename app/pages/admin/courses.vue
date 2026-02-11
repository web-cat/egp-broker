<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="courseColumns"
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

interface CourseRow {
  id: string
  ltiContextId: string
  label: string | null
  title: string | null
  enrollmentCount: number
  assignmentCount: number
  createdAt: string
}

const route = useRoute()
const deploymentFilter = computed(() => route.query.d as string | undefined)
const platformFilter = computed(() => route.query.p as string | undefined)

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
  d: deploymentFilter,
  p: platformFilter
})

const courseColumns: TableColumn<CourseRow>[] = [
  {
    accessorKey: 'label',
    header: 'Code',
    cell: ({ row }) => row.getValue('label') || '—'
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'ltiContextId',
    header: 'LTI Context ID'
  },
  {
    accessorKey: 'enrollmentCount',
    header: 'Enrollments',
    cell: countBadgeCell('enrollmentCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'assignmentCount',
    header: 'Assignments',
    cell: countBadgeCell('assignmentCount', 'info'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<CourseRow>((row) => [
    [
      { label: 'View enrollments', icon: 'i-lucide-users' },
      {
        label: 'View assignments',
        icon: 'i-lucide-clipboard-list',
        onSelect: () =>
          navigateTo({ path: '/admin/assignments', query: { c: row.original.label } })
      },
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>
