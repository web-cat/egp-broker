<template>
  <UModal
    :open="open"
    :title="`Assignment Details: ${assignment?.title || ''}`"
    :description="`Master deadlines, Canvas section/student overrides, and student pass redemptions.`"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Associated LTI Tool -->
        <div
          class="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50"
        >
          <div class="flex items-center gap-2.5">
            <UIcon name="i-lucide-wrench" class="w-4 h-4 text-primary-500" />
            <span
              class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              LTI Tool:
            </span>
            <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ assignment?.toolName || 'None' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="assignment?.toolSupportsPassport"
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="isSyncingPassPort"
              :disabled="loadingRedemptions"
              @click="handlePassPortSync"
            >
              Sync PassPort
            </UButton>
            <UBadge v-if="assignment?.toolName" color="primary" variant="subtle" size="xs">
              <UIcon name="i-lucide-link" class="w-3 h-3 mr-1" />
              Connected
            </UBadge>
            <UBadge v-else color="neutral" variant="subtle" size="xs"> Not Configured </UBadge>
          </div>
        </div>

        <!-- Master Assignment Baseline Dates Card -->
        <div
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4
              class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              Master Default Schedule
            </h4>
            <UBadge
              v-if="assignment?.published === false"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              <UIcon name="i-lucide-eye-off" class="w-3 h-3 mr-1 text-neutral-500" />
              Unpublished
            </UBadge>
            <UBadge v-else color="success" variant="subtle" size="xs">
              <UIcon name="i-lucide-check" class="w-3 h-3 mr-1" />
              Published
            </UBadge>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block"
                >Available From</span
              >
              <span class="font-medium text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.availableFrom) || '—' }}
              </span>
            </div>
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block">Due Date</span>
              <span class="font-semibold text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.dueDate) || '—' }}
              </span>
            </div>
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block"
                >Accept Until (Cutoff)</span
              >
              <span class="font-medium text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.acceptUntil) || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- CBTF Reservation Status Visual (CBTF Assignments Only) -->
        <div
          v-if="assignment?.isSchedulable"
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 space-y-3"
          data-testid="cbtf-summary-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div
              class="flex items-center gap-2 font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              <UIcon name="i-lucide-landmark" class="w-4 h-4 text-primary-500" />
              CBTF Reservation Status
            </div>
            <div class="flex items-center gap-3 text-neutral-500 dark:text-neutral-400 font-medium">
              <span v-if="cbtfSummary?.reservationWindowEnd" data-testid="reservation-window-end">
                Window closes:
                <strong class="text-neutral-700 dark:text-neutral-300">
                  {{ formatDate(cbtfSummary.reservationWindowEnd) }}
                </strong>
              </span>
              <span
                v-if="cbtfSummary"
              >
                Total Enrolled:
                <strong class="text-neutral-900 dark:text-neutral-100">
                  {{ cbtfSummary.totalEnrolledCount }}
                </strong>
                {{ cbtfSummary.totalEnrolledCount === 1 ? 'Student' : 'Students' }}
              </span>
            </div>
          </div>

          <!-- Loading state -->
          <div
            v-if="loadingCbtfSummary"
            class="py-3 flex items-center justify-center gap-2 text-xs text-neutral-400"
          >
            <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin text-primary-500" />
            Loading reservation metrics…
          </div>

          <!-- Loaded state -->
          <div v-else-if="cbtfSummary" class="space-y-3">
            <!-- Multi-Segment Horizontal Progress Bar -->
            <div
              class="flex h-3.5 w-full rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800"
              role="progressbar"
              :aria-valuenow="cbtfSummary.completedPct"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <UTooltip
                v-if="cbtfSummary.completedPct > 0"
                :text="`Completed: ${cbtfSummary.completedCount} (${cbtfSummary.completedPct}%)`"
                :style="{ width: `${cbtfSummary.completedPct}%` }"
                class="h-full transition-all duration-300"
              >
                <div
                  class="h-full w-full bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer"
                  data-testid="progress-completed"
                />
              </UTooltip>
              <UTooltip
                v-if="cbtfSummary.scheduledPct > 0"
                :text="`Scheduled: ${cbtfSummary.scheduledCount} (${cbtfSummary.scheduledPct}%)`"
                :style="{ width: `${cbtfSummary.scheduledPct}%` }"
                class="h-full transition-all duration-300"
              >
                <div
                  class="h-full w-full bg-primary-500 hover:bg-primary-600 transition-colors cursor-pointer"
                  data-testid="progress-scheduled"
                />
              </UTooltip>
              <UTooltip
                v-if="cbtfSummary.unscheduledPct > 0"
                :text="`Not Scheduled: ${cbtfSummary.unscheduledCount} (${cbtfSummary.unscheduledPct}%)`"
                :style="{ width: `${cbtfSummary.unscheduledPct}%` }"
                class="h-full transition-all duration-300"
              >
                <div
                  class="h-full w-full bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400 dark:hover:bg-neutral-600 transition-colors cursor-pointer"
                  data-testid="progress-unscheduled"
                />
              </UTooltip>
              <!-- Empty state fallback if total count is 0 -->
              <div
                v-if="cbtfSummary.totalEnrolledCount === 0"
                class="h-full w-full bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-400 flex items-center justify-center"
              >
                No enrolled students
              </div>
            </div>

            <!-- Metric Stat Chips -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <!-- Completed -->
              <div
                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800"
              >
                <UIcon name="i-lucide-check-circle" class="w-4 h-4 text-emerald-500 shrink-0" />
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-none"
                  >
                    Completed
                  </p>
                  <p
                    class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1"
                    data-testid="stat-completed"
                  >
                    {{ cbtfSummary.completedCount }}
                    <span class="text-xs font-normal text-neutral-500">
                      ({{ cbtfSummary.completedPct }}%)
                    </span>
                  </p>
                </div>
              </div>

              <!-- Scheduled -->
              <div
                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800"
              >
                <UIcon name="i-lucide-calendar-clock" class="w-4 h-4 text-primary-500 shrink-0" />
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-none"
                  >
                    Scheduled
                  </p>
                  <p
                    class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1"
                    data-testid="stat-scheduled"
                  >
                    {{ cbtfSummary.scheduledCount }}
                    <span class="text-xs font-normal text-neutral-500">
                      ({{ cbtfSummary.scheduledPct }}%)
                    </span>
                  </p>
                </div>
              </div>

              <!-- Not Scheduled -->
              <div
                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800"
              >
                <UIcon name="i-lucide-alert-circle" class="w-4 h-4 text-neutral-400 shrink-0" />
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-none"
                  >
                    Not Scheduled
                  </p>
                  <p
                    class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1"
                    data-testid="stat-unscheduled"
                  >
                    {{ cbtfSummary.unscheduledCount }}
                    <span class="text-xs font-normal text-neutral-500">
                      ({{ cbtfSummary.unscheduledPct }}%)
                    </span>
                  </p>
                </div>
              </div>

              <!-- Open Seats Remaining -->
              <div
                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800"
              >
                <UIcon
                  name="i-lucide-armchair"
                  :class="[
                    'w-4 h-4 shrink-0',
                    cbtfSummary.remainingOpenSeats >= cbtfSummary.unscheduledCount
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  ]"
                />
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-none"
                  >
                    Open Seats
                  </p>
                  <p
                    class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1"
                    data-testid="stat-open-seats"
                  >
                    {{ cbtfSummary.remainingOpenSeats }}
                    <span class="text-xs font-normal text-neutral-500">
                      ({{ cbtfSummary.remainingOpenSlots }} {{ cbtfSummary.remainingOpenSlots === 1 ? 'slot' : 'slots' }})
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Canvas Overrides Table -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4
              class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
            >
              <UIcon name="i-lucide-calendar-clock" class="w-4 h-4 text-primary-500" />
              Canvas Section & Individual Overrides ({{ overrides.length }})
            </h4>
          </div>
          <BaseDataTable
            :data="overrides"
            :columns="overrideColumns"
            :loading="loadingOverrides"
            searchable
            search-placeholder="Search overrides…"
            empty-icon="i-lucide-calendar-x"
            empty-text="No section or individual student overrides configured on Canvas."
          />
        </div>

        <!-- Student Pass Redemptions Table -->
        <div class="space-y-3 pt-2">
          <div class="flex items-center justify-between">
            <h4
              class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
            >
              <UIcon name="i-lucide-ticket" class="w-4 h-4 text-primary-500" />
              Student Pass Redemptions ({{ redemptions.length }})
            </h4>
          </div>
          <BaseDataTable
            :data="redemptions"
            :columns="redemptionColumns"
            :loading="loadingRedemptions"
            searchable
            search-placeholder="Search students or passes…"
            empty-icon="i-lucide-history"
            empty-text="No pass redemptions found for this assignment."
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div>
          <UButton
            v-if="assignment?.toolSupportsPassport"
            color="primary"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="isSyncingPassPort"
            :disabled="loadingRedemptions"
            @click="handlePassPortSync"
          >
            Sync PassPort
          </UButton>
        </div>
        <UButton
          label="Close"
          color="neutral"
          variant="outline"
          @click="$emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { AssignmentRedemptionRow } from '@@/shared/models/teacher'
import type { AssignmentOverrideDetails } from '@@/shared/models/override'
import type { AssignmentRow } from '@@/shared/models/assignment'
import type { CbtfAssignmentReservationSummary } from '@@/shared/models/cbtf'
import { formatDate } from '~/utils/date'

const props = defineProps<{
  open: boolean
  assignment: AssignmentRow | null
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()

const redemptions = ref<AssignmentRedemptionRow[]>([])
const overrides = ref<AssignmentOverrideDetails[]>([])
const cbtfSummary = ref<CbtfAssignmentReservationSummary | null>(null)
const loadingRedemptions = ref(false)
const loadingOverrides = ref(false)
const loadingCbtfSummary = ref(false)
const isSyncingPassPort = ref(false)
const toast = useToast()

const handlePassPortSync = async () => {
  if (!props.assignment?.id) return
  isSyncingPassPort.value = true

  try {
    const res = await $fetch<{
      data: { syncedCount: number; failedCount: number; totalCount: number }
    }>(`/api/me/assignments/${props.assignment.id}/passport-sync`, {
      method: 'POST'
    })

    const { syncedCount, failedCount, totalCount } = res.data
    if (failedCount > 0) {
      toast.add({
        title: 'PassPort Sync Partial',
        description: `Synced ${syncedCount} of ${totalCount} redemption(s) to ${props.assignment.toolName || 'tool'}. (${failedCount} failed)`,
        color: 'warning'
      })
    } else {
      toast.add({
        title: 'PassPort Resync Complete',
        description: `Successfully sent ${syncedCount} pass redemption date value(s) to ${props.assignment.toolName || 'external tool'}.`,
        color: 'success'
      })
    }
    await fetchData()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync with external tool'
    toast.add({
      title: 'PassPort Sync Failed',
      description: message,
      color: 'error'
    })
  } finally {
    isSyncingPassPort.value = false
  }
}

const fetchData = async () => {
  if (!props.assignment?.id) return
  loadingRedemptions.value = true
  loadingOverrides.value = true
  if (props.assignment.isSchedulable) {
    loadingCbtfSummary.value = true
  } else {
    cbtfSummary.value = null
  }

  try {
    const [redemptionRes, overrideRes, cbtfSummaryRes] = await Promise.all([
      $fetch<{ data: AssignmentRedemptionRow[] }>(
        `/api/me/assignments/${props.assignment.id}/redemptions`
      ).catch(() => ({ data: [] })),
      $fetch<{ data: AssignmentOverrideDetails[] }>(
        `/api/me/assignments/${props.assignment.id}/overrides`
      ).catch(() => ({ data: [] })),
      props.assignment.isSchedulable
        ? $fetch<{ data: CbtfAssignmentReservationSummary }>(
            `/api/me/assignments/${props.assignment.id}/cbtf-reservation-summary`
          ).catch(() => ({ data: null }))
        : Promise.resolve({ data: null })
    ])
    redemptions.value = redemptionRes.data || []
    overrides.value = overrideRes.data || []
    cbtfSummary.value = cbtfSummaryRes.data || null
  } catch (err) {
    console.error(err)
    redemptions.value = []
    overrides.value = []
    cbtfSummary.value = null
  } finally {
    loadingRedemptions.value = false
    loadingOverrides.value = false
    loadingCbtfSummary.value = false
  }
}

watch(
  () => [props.open, props.assignment?.id],
  ([isOpen, id]) => {
    if (isOpen && id) {
      fetchData()
    } else {
      redemptions.value = []
      overrides.value = []
    }
  },
  { immediate: true }
)

const overrideColumns: any[] = [
  {
    accessorKey: 'targetName',
    header: 'Target / Scope',
    cell: ({ row }: { row: any }) => {
      const isSection = row.original.type === 'SECTION'
      return h('div', { class: 'flex items-center gap-2' }, [
        h(resolveComponent('UIcon'), {
          name: isSection ? 'i-lucide-users' : 'i-lucide-user',
          class: 'w-4 h-4 text-neutral-500'
        }),
        h(
          'span',
          { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
          row.getValue('targetName')
        )
      ])
    }
  },
  {
    accessorKey: 'title',
    header: 'Override Title',
    cell: ({ row }: { row: any }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'availableFrom',
    header: 'Available From',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('availableFrom')) || '—'
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }: { row: any }) => {
      const formatted = formatDate(row.getValue('dueDate')) || '—'
      return h('span', { class: 'font-semibold text-neutral-900 dark:text-neutral-100' }, formatted)
    }
  },
  {
    accessorKey: 'acceptUntil',
    header: 'Accept Until',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('acceptUntil')) || '—'
  }
]

const redemptionColumns: any[] = [
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) => {
      const name = row.getValue('studentName') || '—'
      const email = row.original.studentEmail
      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium text-neutral-900 dark:text-neutral-100' }, name),
        email && h('span', { class: 'text-xs text-neutral-500 dark:text-neutral-400' }, email)
      ])
    }
  },
  {
    accessorKey: 'sectionName',
    header: 'Section',
    cell: ({ row }: { row: any }) => row.getValue('sectionName') || '—'
  },
  {
    accessorKey: 'passTypeName',
    header: 'Pass Type',
    cell: ({ row }: { row: any }) => {
      return h(
        'span',
        {
          class: 'inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400'
        },
        [
          h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-3.5 h-3.5' }),
          row.getValue('passTypeName')
        ]
      )
    }
  },
  {
    accessorKey: 'cost',
    header: 'Cost',
    cell: ({ row }: { row: any }) => `${row.getValue('cost')} pass(es)`
  },
  {
    accessorKey: 'redeemedAt',
    header: 'Redeemed',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('redeemedAt')) || '—'
  },
  {
    accessorKey: 'dueDate',
    header: 'New Deadline',
    cell: ({ row }: { row: any }) =>
      formatDate(row.original.acceptUntil || row.original.dueDate) || '—'
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }: { row: any }) => {
      const active = row.getValue('isActive')
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('div', {
          class: [
            'w-2 h-2 rounded-full',
            active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
          ]
        }),
        h(
          'span',
          {
            class: active
              ? 'text-green-600 dark:text-green-400 font-medium text-xs'
              : 'text-neutral-500 text-xs'
          },
          active ? 'Active' : 'Expired'
        )
      ])
    }
  }
]
</script>
