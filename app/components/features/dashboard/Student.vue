<template>
  <UPageHeader
    :title="courseCode ? `${courseCode}: ${courseTitle || ''}` : courseTitle || ''"
    :description="t('pages.dashboard.student.subtitle')"
    icon="i-lucide-book-open"
    class="border-b-0"
  />

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Pass Pools -->
    <BaseCard v-for="pool in passPools?.data" :key="pool.id">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium uppercase">
            {{ pool.balance === 1 ? pool.name : $plural(pool.name) }}
          </p>
          <p class="text-4xl font-bold text-primary-600 dark:text-primary-400 mt-1">
            {{ pool.balance }}
          </p>
        </div>
        <div class="p-4 bg-primary-100 dark:bg-primary-900/50 rounded-full">
          <UIcon name="i-lucide-coins" class="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </BaseCard>

    <!-- Next Deadline -->
    <BaseCard>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium uppercase">
            {{ t('pages.dashboard.student.stats.nextDeadline') }}
          </p>
          <p class="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {{ t('global.empty.noUpcoming') }}
          </p>
        </div>
        <div class="p-4 bg-secondary-100 dark:bg-secondary-900/50 rounded-full">
          <UIcon
            name="i-lucide-calendar-clock"
            class="w-8 h-8 text-secondary-600 dark:text-secondary-400"
          />
        </div>
      </div>
    </BaseCard>
  </div>

  <!-- My Assignments -->
  <div class="space-y-4 pt-8">
    <div class="flex items-center justify-between px-1">
      <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('pages.dashboard.student.assignments.title') }}
      </h3>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        size="sm"
        :loading="assignmentsStatus === 'pending'"
        @click="() => refreshAssignments()"
      />
    </div>
    <BaseDataTable
      :data="filteredAssignments"
      :columns="assignmentColumns"
      :row-class="assignmentRowClass"
      :loading="assignmentsStatus === 'pending'"
      searchable
      search-placeholder="Search assignments…"
      empty-icon="i-lucide-clipboard-list"
      :empty-text="t('pages.dashboard.student.assignments.empty')"
    />
  </div>

  <!-- My Redemptions -->
  <div class="space-y-4 pt-8">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 px-1">
      {{ t('pages.dashboard.student.redemptions.title') }}
    </h3>
    <BaseDataTable
      :data="redemptionsData?.data"
      :columns="redemptionColumns"
      :loading="redemptionsStatus === 'pending'"
      searchable
      search-placeholder="Search redemptions…"
      empty-icon="i-lucide-history"
      :empty-text="t('pages.dashboard.student.redemptions.empty')"
    />
  </div>

  <FeaturesDashboardRedemptionConfirmationModal
    v-if="selectedAssignment && selectedPassType"
    v-model:open="showRedemptionModal"
    :assignment="selectedAssignment"
    :pass-type="selectedPassType"
    :hours-per-pass="selectedPassHours"
    :loading="redemptionLoading"
    @confirm="handleConfirmRedemption"
  />
</template>

<script setup lang="ts">
// Feature Composable
import { useStudentDashboard } from '~/composables/features/useStudentDashboard'

const { t } = useI18n()

defineProps<{
  courseTitle?: string | null
  courseCode?: string | null
  isAdmin: boolean
}>()

const {
  passPools,
  assignmentsStatus,
  refreshAssignments,
  filteredAssignments,
  assignmentColumns,
  redemptionsData,
  redemptionsStatus,
  // Modal State
  showRedemptionModal,
  selectedAssignment,
  selectedPassType,
  selectedPassHours,
  redemptionLoading,
  handleConfirmRedemption,
  dateCellRenderer
} = useStudentDashboard()

const assignmentRowClass = (row: any) => {
  if (row.original.highlight) {
    return 'bg-primary-50/50 dark:bg-primary-900/10 border-l-4 border-l-primary-500 dark:border-l-primary-400'
  }
  return 'border-l-4 border-l-transparent opacity-75 hover:opacity-100 transition-opacity'
}

const redemptionColumns: any[] = [
  {
    accessorKey: 'assignmentTitle',
    header: 'Assignment',
    cell: ({ row }: { row: any }) => row.getValue('assignmentTitle') || '—'
  },
  {
    accessorKey: 'redeemedAt',
    header: 'Redeemed',
    cell: dateCellRenderer('redeemedAt')
  },
  {
    accessorKey: 'cost',
    header: 'Cost',
    cell: ({ row }: { row: any }) => `${row.getValue('cost')} pass(es)`
  },
  {
    accessorKey: 'hoursPerPass',
    header: 'Hours/Pass',
    cell: ({ row }: { row: any }) => `${row.getValue('hoursPerPass')}h`
  },
  {
    accessorKey: 'acceptUntil',
    header: 'New Deadline',
    cell: dateCellRenderer('acceptUntil')
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }: { row: any }) => {
      const active = row.getValue('isActive')
      return h('div', { class: 'flex items-center gap-2' }, [
        h('div', {
          class: [
            'w-2 h-2 rounded-full',
            active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
          ]
        }),
        h(
          'span',
          { class: active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-neutral-500' },
          active ? 'Active' : 'Expired'
        )
      ])
    }
  }
]
</script>
