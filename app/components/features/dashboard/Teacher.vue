<template>
  <UPageHeader
    :title="courseCode ? `${courseCode}: ${courseTitle || ''}` : courseTitle || ''"
    :description="t('pages.dashboard.teacher.subtitle')"
    class="border-b-0"
  />

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Quick Stats -->
    <BaseCard>
      <div class="text-center">
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
          {{ t('pages.dashboard.teacher.stats.activeAssignments') }}
        </p>
        <p class="text-4xl font-bold text-primary-600 dark:text-primary-400 mt-1">0</p>
      </div>
    </BaseCard>

    <BaseCard>
      <div class="text-center">
        <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
          {{ t('pages.dashboard.teacher.stats.pendingRequests') }}
        </p>
        <p class="text-4xl font-bold text-secondary-600 dark:text-secondary-400 mt-1">0</p>
      </div>
    </BaseCard>

    <BaseCard>
      <div class="text-center">
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
    <BaseDataTable
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
    </BaseDataTable>
  </div>

  <!-- Assignments Management -->
  <div class="space-y-4 pt-8">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 px-1">Assignments</h3>
    <BaseDataTable
      :key="assignmentsTableKey"
      :data="sortedAssignments"
      :columns="assignmentColumns"
      :row-class="assignmentRowClass"
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
          color="neutral"
          class="mr-2"
          @click="syncAssignments"
        />
        <UButton icon="i-lucide-plus" label="Add Assignment" @click="openAssignmentCreate" />
      </template>
    </BaseDataTable>
  </div>

  <FeaturesAdminPassTypeEditPanel
    v-model:open="passTypeEditOpen"
    :pass-type="editingPassType"
    @saved="onPassTypeRowUpdated"
    @created="onPassTypeItemCreated"
  />

  <FeaturesAdminAssignmentEditPanel
    v-model:open="assignmentEditOpen"
    :assignment="editingAssignment"
    :pass-types="passTypesData?.data"
    @saved="onAssignmentSavedWithRefresh"
    @created="onAssignmentItemCreated"
  />
</template>

<script setup lang="ts">
import type { PassTypeData } from '@@/shared/models/pass'
import type { AssignmentRow } from '@@/shared/models/assignment'

import { formatDate } from '~/utils/date'
// Feature Composable
import { useTeacherDashboard } from '~/composables/features/useTeacherDashboard'

const { t } = useI18n()

defineProps<{
  courseTitle?: string | null
  courseCode?: string | null
  isAdmin: boolean
}>()

const {
  // Pass Types
  passTypesData,
  passTypesStatus,
  passTypeEditOpen,
  editingPassType,
  passTypesTableKey,
  openPassTypeCreate,
  openPassTypeEdit,
  onPassTypeRowUpdated,
  onPassTypeItemCreated,

  // Assignments
  assignmentsData,
  assignmentsStatus,
  assignmentEditOpen,
  editingAssignment,
  assignmentsTableKey,
  openAssignmentCreate,
  openAssignmentEdit,
  onAssignmentItemCreated,

  // Sync
  canSync,
  syncing,
  syncAssignments
} = useTeacherDashboard()

// When an assignment is saved with eligibility changes, do a full refresh
// instead of in-place update since eligibility data comes from the server
const onAssignmentSavedWithRefresh = () => {
  onAssignmentItemCreated()
}

const passTypeColumns: any[] = [
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
    cell: ({ row }: { row: any }) => {
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

const sortedAssignments = computed(() => {
  if (!assignmentsData.value?.data) return []

  return [...assignmentsData.value.data]
    .sort((a, b) => {
      // Priority 1: Eligible for redemption first
      const aEligible = (a.eligiblePassTypeNames?.length ?? 0) > 0
      const bEligible = (b.eligiblePassTypeNames?.length ?? 0) > 0

      if (aEligible && !bEligible) return -1
      if (!aEligible && bEligible) return 1

      // Priority 2: Due Date Ascending (Nulls last)
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .map((a) => ({
      ...a,
      highlight: (a.eligiblePassTypeNames?.length ?? 0) > 0
    }))
})

const assignmentRowClass = (row: any) => {
  if (row.original.highlight) {
    return 'bg-primary-50/50 dark:bg-primary-900/10 border-l-4 border-l-primary-500 dark:border-l-primary-400'
  }
  return 'border-l-4 border-l-transparent opacity-75 hover:opacity-100 transition-opacity'
}

const assignmentColumns: any[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }: { row: any }) => {
      const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
      const isHidden =
        row.original.availableFrom && new Date(row.original.availableFrom) > new Date()

      return h('div', { class: 'flex items-center gap-2' }, [
        isHidden &&
          h(resolveComponent('UTooltip'), { text: 'Hidden from students' }, () => [
            h(resolveComponent('UIcon'), {
              name: 'i-lucide-eye-off',
              class: 'w-4 h-4 text-neutral-400 dark:text-neutral-500'
            })
          ]),
        h(
          'span',
          {
            class: isEligible
              ? 'font-bold text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          },
          row.getValue('title') || '—'
        )
      ])
    }
  },
  {
    accessorKey: 'eligiblePassTypeNames',
    header: 'Pass Type(s)',
    cell: ({ row }: { row: any }) => {
      const names = row.original.eligiblePassTypeNames || []
      if (!names.length) return '—'

      return h(
        'div',
        { class: 'flex flex-wrap gap-3' },
        names.map((name: string) =>
          h(
            'div',
            {
              class:
                'flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium text-sm'
            },
            [h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-4 h-4' }), name]
          )
        )
      )
    }
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }: { row: any }) => {
      const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
      const content = formatDate(row.getValue('dueDate')) || '—'
      return h('span', { class: isEligible ? '' : 'text-gray-400 dark:text-gray-500' }, content)
    }
  },
  {
    accessorKey: 'availableFrom',
    header: 'Available From',
    cell: ({ row }: { row: any }) => {
      const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
      const content = formatDate(row.getValue('availableFrom')) || '—'
      return h('span', { class: isEligible ? '' : 'text-gray-400 dark:text-gray-500' }, content)
    }
  },
  actionsColumn<AssignmentRow>((row) => [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openAssignmentEdit(row.original) }]
  ])
]
</script>
