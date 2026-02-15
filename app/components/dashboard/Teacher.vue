<template>
  <UPageHeader
    :title="courseCode ? `${courseCode}: ${courseTitle}` : courseTitle"
    :description="t('pages.dashboard.teacher.subtitle')"
    class="border-b-0"
  />

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Quick Stats -->
    <BaseCard>
      <div class="text-center py-4">
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
          {{ t('pages.dashboard.teacher.stats.activeAssignments') }}
        </p>
        <p class="text-4xl font-bold text-primary-600 dark:text-primary-400 mt-1">0</p>
      </div>
    </BaseCard>

    <BaseCard>
      <div class="text-center py-4">
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
          {{ t('pages.dashboard.teacher.stats.pendingRequests') }}
        </p>
        <p class="text-4xl font-bold text-secondary-600 dark:text-secondary-400 mt-1">0</p>
      </div>
    </BaseCard>

    <BaseCard>
      <div class="text-center py-4">
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
          {{ t('pages.dashboard.teacher.stats.enrolledStudents') }}
        </p>
        <p class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">0</p>
      </div>
    </BaseCard>
  </div>

  <!-- Pass Types Management -->
  <div class="space-y-4 pt-8">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 px-1">Pass Types</h3>
    <UiDataTable
      :key="passTypesTableKey"
      :data="passTypesData?.data"
      :columns="passTypeColumns"
      :loading="passTypesStatus === 'pending'"
      searchable
      search-placeholder="Search pass types…"
      empty-icon="i-lucide-coins"
      empty-text="No pass types configured yet."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Pass Type" @click="openPassTypeCreate" />
      </template>
    </UiDataTable>
  </div>

  <!-- Assignments Management -->
  <div class="space-y-4 pt-8">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 px-1">Assignments</h3>
    <UiDataTable
      :key="assignmentsTableKey"
      :data="assignmentsData?.data"
      :columns="assignmentColumns"
      :loading="assignmentsStatus === 'pending'"
      searchable
      search-placeholder="Search assignments…"
      empty-icon="i-lucide-clipboard-list"
      empty-text="No assignments found."
    >
      <template #toolbar>
        <UButton
          v-if="canSync"
          :loading="syncing"
          icon="i-lucide-refresh-cw"
          label="Sync assignments"
          variant="ghost"
          color="white"
          class="mr-2"
          @click="syncAssignments"
        />
        <UButton icon="i-lucide-plus" label="Add Assignment" @click="openAssignmentCreate" />
      </template>
    </UiDataTable>
  </div>

  <AdminPassTypeEditPanel
    v-model:open="passTypeEditOpen"
    :pass-type="editingPassType"
    @saved="onPassTypeRowUpdated"
    @created="onPassTypeItemCreated"
  />

  <AdminAssignmentEditPanel
    v-model:open="assignmentEditOpen"
    :assignment="editingAssignment"
    @saved="onAssignmentRowUpdated"
    @created="onAssignmentItemCreated"
  />
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PassTypeData } from '@@/shared/models/pass'
import type { AssignmentRow } from '@@/shared/models/assignment'

const { t } = useI18n()

defineProps<{
  courseTitle: string | null
  courseCode: string | null
  isAdmin: boolean
}>()

// Pass Types Data
const {
  data: passTypesData,
  status: passTypesStatus,
  editOpen: passTypeEditOpen,
  editingItem: editingPassType,
  tableKey: passTypesTableKey,
  openCreate: openPassTypeCreate,
  openEdit: openPassTypeEdit,
  onRowUpdated: onPassTypeRowUpdated,
  onItemCreated: onPassTypeItemCreated
} = useAdminCrud<PassTypeData>('/api/me/pass-types')

// Assignments Data
const {
  data: assignmentsData,
  status: assignmentsStatus,
  editOpen: assignmentEditOpen,
  editingItem: editingAssignment,
  tableKey: assignmentsTableKey,
  openCreate: openAssignmentCreate,
  openEdit: openAssignmentEdit,
  onRowUpdated: onAssignmentRowUpdated,
  onItemCreated: onAssignmentItemCreated
} = useAdminCrud<AssignmentRow>('/api/me/assignments')

// Sync Logic
const { data: syncStatus } = await useFetch<{ data: { canSync: boolean } }>('/api/me/sync-status', {
  lazy: true
})
const canSync = computed(() => syncStatus.value?.data?.canSync ?? false)
const syncing = ref(false)

async function syncAssignments() {
  if (!confirm('This will fetch assignments from the LMS and update the list. Continue?')) return

  syncing.value = true
  try {
    const { data } = await $fetch<{ data: AssignmentRow[] }>('/api/me/assignments/sync', {
      method: 'POST'
    })

    // Update the table data directly manually since useAdminCrud might not expose a refresh easily
    // or we can just trigger a refresh if we had access to refresh.
    // assignmentsData is a Ref returned by useAdminCrud.
    // We can overwrite it if it's not readonly.
    // useAdminCrud returns `data` which is a ref.
    if (assignmentsData.value) {
      assignmentsData.value.data = data
    }

    const toast = useToast()
    toast.add({ title: 'Assignments synced successfully', color: 'success' })
  } catch (err: any) {
    console.error(err)
    const toast = useToast()
    toast.add({
      title: 'Sync failed',
      description: err.data?.message || err.message,
      color: 'error'
    })
  } finally {
    syncing.value = false
  }
}

const passTypeColumns: TableColumn<PassTypeData>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'initialBalance',
    header: 'Initial Balance'
  },
  {
    accessorKey: 'hoursPerPass',
    header: 'Hours/Pass'
  },
  {
    accessorKey: 'extensionOnly',
    header: 'Policy',
    cell: ({ row }) => {
      const ext = row.original.extensionOnly
      const req = row.original.allowRequests
      const tags = []
      if (ext) tags.push('Extension Only')
      if (req) tags.push('Requests Allowed')
      return tags.join(', ') || 'Standard'
    }
  },
  actionsColumn<PassTypeData>((row) => [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openPassTypeEdit(row.original) }],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: async () => {
          if (confirm('Are you sure you want to delete this pass type?')) {
            await $fetch(`/api/me/pass-types/${row.original.id}`, { method: 'DELETE' })
            onPassTypeItemCreated() // Refresh table
          }
        }
      }
    ]
  ])
]

const assignmentColumns: TableColumn<AssignmentRow>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'eligiblePassTypeNames',
    header: 'Pass Type(s)',
    cell: ({ row }) => {
      const names = row.original.eligiblePassTypeNames || []
      return names.join(', ') || 'None'
    }
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
  actionsColumn<AssignmentRow>((row) => [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openAssignmentEdit(row.original) }]
  ])
]
</script>
