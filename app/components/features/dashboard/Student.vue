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
</template>

<script setup lang="ts">
import { UBadge } from '#components'
import { formatDate } from '~/utils/date'
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
  assignmentsData,
  assignmentsStatus,
  refreshAssignments,
  redemptionsData,
  redemptionsStatus
} = useStudentDashboard()

const assignmentColumns: any[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }: { row: any }) => {
      const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
      return h(
        'span',
        {
          class: isEligible
            ? 'font-bold text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400'
        },
        row.getValue('title') || '—'
      )
    }
  },
  {
    accessorKey: 'eligiblePassTypeNames',
    header: 'Eligible Pass Types',
    cell: ({ row }: { row: any }) => {
      const names = row.original.eligiblePassTypeNames || []
      if (!names.length) return '—'

      return h(
        'div',
        { class: 'flex flex-wrap gap-3' },
        names.map((name: string) =>
          h('div', { class: 'flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium text-sm' }, [
            h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-4 h-4' }),
            name
          ])
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
  }
]

const filteredAssignments = computed(() => {
  if (!assignmentsData.value?.data) return []

  const now = new Date()

  return assignmentsData.value.data
    .filter((a) => {
      const { dueDate, acceptUntil, eligibleUntil, eligiblePassTypeNames } = a

      // 1. Implicit Infinite: explicit eligibility but no cutoff date => Always Eligible
      const hasPassTypes = eligiblePassTypeNames && eligiblePassTypeNames.length > 0
      if (hasPassTypes && !eligibleUntil) return true

      // 2. Max Date Logic
      const dates = []
      if (dueDate) dates.push(new Date(dueDate))
      if (acceptUntil) dates.push(new Date(acceptUntil))
      if (eligibleUntil) dates.push(new Date(eligibleUntil))

      // If all dates are missing, treat as inactive/hidden (unless caught by implicit infinite above)
      if (dates.length === 0) return false

      // Calculate max date
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

      // Keep if max date is in the future
      return maxDate > now
    })
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
