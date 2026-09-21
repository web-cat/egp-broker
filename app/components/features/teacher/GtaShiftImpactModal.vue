<script setup lang="ts">
import { computed } from 'vue'
import type { ShiftImpactSummary } from '@@/shared/schemas/gta-interview.schema'

const props = defineProps<{
  open: boolean
  impact?: ShiftImpactSummary | null
  actionType?: 'edit' | 'delete'
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const rescheduled = computed(() => props.impact?.rescheduled || [])
const cancelled = computed(() => props.impact?.cancelled || [])

const hasImpact = computed(() => rescheduled.value.length > 0 || cancelled.value.length > 0)

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
    title="Shift Modification Impact Summary"
    description="Student appointments affected by changing or removing this GTA shift."
  >
    <template #body>
      <div class="space-y-5">
        <p v-if="!hasImpact" class="text-sm text-neutral-500 italic">
          No students were affected by this shift change.
        </p>

        <!-- Rescheduled Students Section -->
        <div v-if="rescheduled.length > 0" class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
              <UIcon name="i-lucide-arrow-right-left" class="w-4 h-4" />
              Automatically Rescheduled ({{ rescheduled.length }})
            </h4>
            <UBadge color="primary" variant="subtle" size="xs">Same appointment time</UBadge>
          </div>
          <p class="text-xs text-neutral-500">
            These students were reassigned to another concurrent on-duty GTA at their exact same appointment time.
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
              <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
              Cancelled Appointments ({{ cancelled.length }})
            </h4>
            <UBadge color="error" variant="subtle" size="xs">Needs Rebooking</UBadge>
          </div>
          <p class="text-xs text-neutral-500">
            No other concurrent on-duty GTA was available at these timeslots. These appointments have been marked as cancelled so students can reschedule.
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
                Cancelled
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          color="neutral"
          variant="outline"
          label="Close"
          @click="isOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>
