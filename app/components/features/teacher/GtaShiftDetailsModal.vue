<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTeacherGtaShifts } from '~/composables/features/useTeacherGtaShifts'
import type { GtaShiftDetailsDto, GtaShiftSlotDetail } from '@@/shared/schemas/gta-interview.schema'

const props = defineProps<{
  open: boolean
  shiftId: string | null
  courseId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'changed'): void
}>()

const { getShiftDetails, rescheduleInterview, cancelInterview } = useTeacherGtaShifts(() => props.courseId)

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const loading = ref(false)
const details = ref<GtaShiftDetailsDto | null>(null)
const actionInProgressId = ref<string | null>(null)

const loadDetails = async () => {
  if (!props.shiftId) return
  loading.value = true
  try {
    const data = await getShiftDetails(props.shiftId)
    details.value = data
  } catch {
    details.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.shiftId],
  ([newOpen, newId]) => {
    if (newOpen && newId) {
      loadDetails()
    } else {
      details.value = null
    }
  },
  { immediate: true }
)

const handleReschedule = async (slot: GtaShiftSlotDetail) => {
  if (!slot.reservation) return
  actionInProgressId.value = slot.reservation.id
  try {
    // Pick the first available concurrent GTA
    const targetGtaId = slot.availableGtas[0]?.id
    await rescheduleInterview(slot.reservation.id, targetGtaId)
    await loadDetails()
    emit('changed')
  } finally {
    actionInProgressId.value = null
  }
}

const handleCancel = async (slot: GtaShiftSlotDetail) => {
  if (!slot.reservation) return
  const confirmed = confirm(
    `Are you sure you want to cancel the appointment for ${slot.reservation.studentName}?`
  )
  if (!confirmed) return

  actionInProgressId.value = slot.reservation.id
  try {
    await cancelInterview(slot.reservation.id)
    await loadDetails()
    emit('changed')
  } finally {
    actionInProgressId.value = null
  }
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="GTA Shift Details & Timeslots"
    description="View all 10-minute intervals for this shift, inspect student bookings, and reschedule or cancel appointments."
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <!-- Loading State -->
      <div v-if="loading" class="py-12 flex flex-col items-center justify-center space-y-3">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary-500" />
        <p class="text-xs text-neutral-500">Loading shift timeslots...</p>
      </div>

      <!-- Content -->
      <div v-else-if="details" class="space-y-4">
        <!-- GTA & Shift Header Banner -->
        <div class="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <UAvatar
              :src="details.shift.gta.avatarUrl || undefined"
              :alt="details.shift.gta.name"
              size="md"
            />
            <div>
              <h4 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {{ details.shift.gta.name }}
              </h4>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ details.shift.gta.email }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 self-end sm:self-center">
            <div class="text-right">
              <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {{ formatDate(details.shift.date) }}
              </p>
              <p class="text-xs font-mono text-neutral-500">
                {{ details.shift.startTime }} - {{ details.shift.endTime }}
              </p>
            </div>
            <div class="flex items-center gap-1.5 pl-2 border-l border-neutral-200 dark:border-neutral-700">
              <UBadge color="primary" variant="subtle" size="xs">
                {{ details.reservedCount }} Reserved
              </UBadge>
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ details.vacantCount }} Vacant
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Timeslots List -->
        <div class="space-y-2">
          <h5 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Shift Slots (10-minute intervals)
          </h5>

          <div class="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div
              v-for="slot in details.slots"
              :key="slot.startTime"
              class="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20"
              :class="{ 'bg-primary-50/20 dark:bg-primary-950/10': slot.isReserved }"
            >
              <!-- Slot Time & Status -->
              <div class="flex items-start gap-3">
                <div class="w-36 shrink-0">
                  <span class="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {{ slot.timeLabel }}
                  </span>
                </div>

                <!-- Vacant Slot -->
                <div v-if="!slot.isReserved" class="flex items-center gap-2">
                  <UBadge color="neutral" variant="subtle" size="xs">
                    Vacant
                  </UBadge>
                  <span class="text-neutral-400 text-xs italic">Available for booking</span>
                </div>

                <!-- Reserved Slot Details -->
                <div v-else class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-neutral-900 dark:text-neutral-100">
                      {{ slot.reservation?.studentName }}
                    </span>
                    <span class="text-neutral-400 font-normal">
                      ({{ slot.reservation?.studentEmail }})
                    </span>
                  </div>
                  <p class="text-neutral-500">
                    <span class="font-medium text-neutral-700 dark:text-neutral-300">
                      {{ slot.reservation?.assignmentTitle }}
                    </span>
                    &bull; Status:
                    <span class="font-medium text-primary-600 dark:text-primary-400">
                      {{ slot.reservation?.status }}
                    </span>
                  </p>
                </div>
              </div>

              <!-- Reservation Actions -->
              <div v-if="slot.isReserved && slot.reservation" class="flex items-center gap-2 self-end sm:self-center shrink-0">
                <!-- Reschedule Button -->
                <UTooltip
                  :text="
                    slot.canReschedule
                      ? `Reschedule to available concurrent GTA: ${slot.availableGtas.map((g) => g.name).join(', ')}`
                      : 'No other on-duty GTA is available at this exact appointment time'
                  "
                >
                  <UButton
                    size="xs"
                    color="primary"
                    variant="subtle"
                    icon="i-lucide-arrow-right-left"
                    label="Reschedule"
                    :disabled="!slot.canReschedule || actionInProgressId === slot.reservation.id"
                    :loading="actionInProgressId === slot.reservation.id"
                    @click="handleReschedule(slot)"
                  />
                </UTooltip>

                <!-- Cancel Button -->
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x-circle"
                  label="Cancel"
                  :disabled="actionInProgressId === slot.reservation.id"
                  @click="handleCancel(slot)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="py-12 text-center text-xs text-neutral-500">
        Shift information could not be loaded.
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          color="neutral"
          variant="outline"
          label="Done"
          @click="isOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>
