<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="assignmentColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search assignments…"
      empty-icon="i-lucide-clipboard-list"
      empty-text="No assignments found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Assignment" @click="openCreate" />
      </template>
    </UiDataTable>

    <AdminAssignmentEditPanel
      v-model:open="editOpen"
      :assignment="editingItem"
      :course-id="createCourseId"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface AssignmentRow {
  id: string
  resourceLinkId: string
  title: string | null
  canvasAssignmentId: string | null
  courseLabel: string | null
  courseTitle: string | null
  dueDate: string | null
  availableFrom: string | null
  acceptUntil: string | null
  createdAt: string
}

const route = useRoute()
const courseFilter = computed(() => route.query.c as string | undefined)
const createCourseId = ref<string | null>(null)

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
} = useAdminCrud<AssignmentRow>('/api/admin/assignments', { c: courseFilter })

const { setTitle } = useAdminPageTitle()

watchEffect(() => {
  if (!courseFilter.value) {
    setTitle('Assignments')
    return
  }
  const firstRow = data.value?.data?.[0]
  const label = courseFilter.value
  const name = firstRow?.courseTitle
  setTitle(name ? `Assignments: ${label} — ${name}` : `Assignments: ${label}`)
})

const assignmentColumns: TableColumn<AssignmentRow>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'courseLabel',
    header: 'Course',
    cell: ({ row }) => {
      const label = row.getValue('courseLabel') as string | null
      const title = row.original.courseTitle
      return label || title || '—'
    }
  },
  {
    accessorKey: 'resourceLinkId',
    header: 'Resource Link ID'
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: dateCellRenderer('dueDate')
  },
  {
    accessorKey: 'availableFrom',
    header: 'Available From',
    cell: dateCellRenderer('availableFrom')
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<AssignmentRow>((row) => [
    [
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>
