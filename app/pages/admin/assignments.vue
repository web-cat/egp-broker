<template>
  <div>
    <BaseDataTable
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
    </BaseDataTable>

    <FeaturesAdminAssignmentEditPanel
      v-model:open="editOpen"
      :assignment="editingItem"
      :course-id="createCourseId"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />

    <BaseConfirmationModal
      v-model:open="deleteOpen"
      title="Delete Assignment"
      :description="`Are you sure you want to delete ${deletingItem?.title || deletingItem?.resourceLinkId || 'this assignment'}?`"
      confirm-label="Delete Assignment"
      confirm-color="error"
      confirm-icon="i-lucide-trash-2"
      :loading="isDeleting"
      @confirm="handleDeleteConfirm"
    >
      <p class="text-sm text-neutral-500">
        This will permanently delete the assignment, its pass eligibilities, and associated results.
        This action cannot be undone.
      </p>
    </BaseConfirmationModal>
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
  [key: string]: any
}

const route = useRoute()
const toast = useToast()
const courseFilter = computed(() => route.query.c as string | undefined)
const createCourseId = ref<string | null>(null)

const {
  data,
  status,
  editOpen,
  editingItem,
  deleteOpen,
  deletingItem,
  tableKey,
  openCreate,
  openEdit,
  openDelete,
  onRowUpdated,
  onRowDeleted,
  onItemCreated
} = useAdminCrud<AssignmentRow>('/api/admin/assignments', { c: courseFilter })

const isDeleting = ref(false)

async function handleDeleteConfirm() {
  if (!deletingItem.value) return
  isDeleting.value = true
  const target = deletingItem.value
  try {
    await $fetch(`/api/admin/assignments/${target.id}`, {
      method: 'DELETE'
    })
    onRowDeleted(target.id)
    deleteOpen.value = false
    toast.add({
      title: 'Assignment Deleted',
      description: `Successfully deleted assignment ${target.title || target.resourceLinkId}`,
      color: 'success'
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string; message?: string } }
    toast.add({
      title: 'Failed to delete assignment',
      description:
        fetchErr.data?.statusMessage || fetchErr.data?.message || 'An unexpected error occurred.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

const { setTitle } = useAdminPageTitle()

watchEffect(() => {
  if (!courseFilter.value) {
    setTitle('Assignments')
    return
  }
  const firstRow = data.value?.data?.[0]
  const label = firstRow?.courseLabel || courseFilter.value
  const name = firstRow?.courseTitle
  setTitle(name ? `Assignments: ${label}: ${name}` : `Assignments: ${label}`)
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
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => openDelete(row.original)
      }
    ]
  ])
]
</script>
