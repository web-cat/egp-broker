<script setup lang="ts">
import { computed } from 'vue'
import type { ShiftImpactSummary } from '@@/shared/schemas/gta-interview.schema'

const props = withDefaults(
  defineProps<{
    open: boolean
    impact?: ShiftImpactSummary | null
    actionType?: 'edit' | 'delete'
    loading?: boolean
  }>(),
  {
    actionType: 'edit',
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'confirm'): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const rescheduled = computed(() => props.impact?.rescheduled || [])
const cancelled = computed(() => props.impact?.cancelled || [])

const hasImpact = computed(() => rescheduled.value.length > 0 || cancelled.value.length > 0)
const totalImpacted = computed(() => rescheduled.value.length + cancelled.value.length)

const modalTitle = computed(() =>
  props.actionType === 'delete' ? 'Confirm Shift Deletion' : 'Confirm Shift Modification'
)

const modalDescription = computed(() =>
  props.actionType === 'delete'
    ? 'Review student appointment impact before permanently removing this shift.'
    : 'Review student appointment impact before applying changes to this shift.'
)

const confirmButtonLabel = computed(() =>
  props.actionType === 'delete' ? 'Confirm & Delete Shift' : 'Confirm & Update Shift'
)

const confirmButtonColor = computed(() => (props.actionType === 'delete' ? 'error' : 'primary'))

const formatTime = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="modalTitle"
    :description="modalDescription"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Notice when no appointments will be affected -->
        <div
          v-if="!hasImpact"
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-4 text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-3"
        >
          <UIcon name="i-lucide-check-circle-2" class="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <div class="space-y-1">
            <p class="font-medium text-neutral-900 dark:text-neutral-100">
              No Appointments Affected
            </p>
            <p>
              {{
                actionType === 'delete'
                  ? 'There are no student reservations booked during this shift. Deleting it will not disrupt any appointments.'
                  : 'All existing student reservations still fit within the adjusted shift bounds. No appointments will be rescheduled or cancelled.'
              }}
            </p>
          </div>
        </div>

        <!-- Warning banner when appointments will be affected -->
        <div
          v-else
          class="rounded-lg border border-warning-200 dark:border-warning-900/50 bg-warning-50 dark:bg-warning-950/20 p-3.5 text-xs text-warning-800 dark:text-warning-300 flex items-start gap-2.5"
        >
          <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
          <div>
            <p class="font-semibold">
              {{ totalImpacted }} student appointment(s) will be affected upon confirmation:
            </p>
            <p class="text-warning-700/90 dark:text-warning-300/80 mt-0.5">
              Appointments that can be covered by another on-duty GTA will be rescheduled automatically. Those with no coverage will be marked as cancelled.
            </p>
          </div>
        </div>

        <!-- Rescheduled Students Section -->
        <div v-if="rescheduled.length > 0" class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
              <UIcon name="i-lucide-arrow-right-left" class="w-4 h-4" />
              Will Be Automatically Rescheduled ({{ rescheduled.length }})
            </h4>
            <UBadge color="primary" variant="subtle" size="xs">Same appointment time</UBadge>
          </div>
          <p class="text-xs text-neutral-500">
            These students will be reassigned to another concurrent on-duty GTA at their exact same appointment time.
          </p>

          <div class="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div
              v-for="item in rescheduled"
              :key="item.reservationId"
              class="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div class="space-y-0.5">
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ item.studentName }}
                  <span class="font-normal text-neutral-500">({{ item.studentEmail }})</span>
                </p>
                <p class="text-neutral-500">
                  <span class="font-medium text-neutral-700 dark:text-neutral-300">{{ item.assignmentTitle }}</span>
                  &bull; {{ formatTime(item.startTime) }}
                </p>
              </div>

              <div class="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800/60 px-2.5 py-1 rounded text-[11px] font-mono shrink-0">
                <span class="text-neutral-500">{{ item.previousGtaName }}</span>
                <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-primary-500" />
                <span class="text-primary-600 dark:text-primary-400 font-semibold">{{ item.newGtaName || 'New GTA' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Cancelled Students Section -->
        <div v-if="cancelled.length > 0" class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-error-600 dark:text-error-400 flex items-center gap-1.5">
              <UIcon name="i-lucide-calendar-x" class="w-4 h-4" />
              Will Be Cancelled ({{ cancelled.length }})
            </h4>
            <UBadge color="error" variant="subtle" size="xs">Needs Rebooking</UBadge>
          </div>
          <p class="text-xs text-neutral-500">
            No other concurrent on-duty GTA is available at these timeslots. These appointments will be marked as cancelled so students can reschedule.
          </p>

          <div class="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div
              v-for="item in cancelled"
              :key="item.reservationId"
              class="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div class="space-y-0.5">
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ item.studentName }}
                  <span class="font-normal text-neutral-500">({{ item.studentEmail }})</span>
                </p>
                <p class="text-neutral-500">
                  <span class="font-medium text-neutral-700 dark:text-neutral-300">{{ item.assignmentTitle }}</span>
                  &bull; {{ formatTime(item.startTime) }}
                </p>
              </div>

              <UBadge color="error" variant="soft" size="xs">
                To Be Cancelled
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          :disabled="loading"
          @click="isOpen = false"
        />
        <UButton
          :color="confirmButtonColor"
          :label="confirmButtonLabel"
          :loading="loading"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
