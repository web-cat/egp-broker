<template>
  <UModal v-model:open="open" :title="modalTitle" :description="modalDescription">
    <template #body>
      <!-- Mode A: Active / Completed / Missed Reservation View -->
      <div v-if="activeOrLatestReservation && !isRescheduling" class="space-y-6">
        <div
          class="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-4"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Interview Reservation
            </span>
            <UBadge
              :color="statusBadgeColor(activeOrLatestReservation.status)"
              variant="subtle"
              size="sm"
            >
              {{ activeOrLatestReservation.status }}
            </UBadge>
          </div>

          <div class="space-y-1">
            <p class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {{ assignment?.title || 'Grading Interview' }}
            </p>
            <p class="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {{
                formatReservationTime(
                  activeOrLatestReservation.startTime,
                  activeOrLatestReservation.endTime
                )
              }}
            </p>
          </div>

          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800"
          >
            <!-- Assigned GTA -->
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-lucide-user"
                  class="w-4 h-4 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div class="min-w-0">
                <p class="text-xs text-neutral-500 font-medium">Assigned Graduate TA</p>
                <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {{ formatGtaName(activeOrLatestReservation.gta) }}
                </p>
              </div>
            </div>

            <!-- Meeting Location -->
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-lucide-map-pin"
                  class="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div class="min-w-0">
                <p class="text-xs text-neutral-500 font-medium">Meeting Location</p>
                <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {{ activeOrLatestReservation.interviewLocation || effectiveLocation }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Missed Alert -->
        <div
          v-if="activeOrLatestReservation.status === 'MISSED'"
          class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5"
        >
          <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            You missed your scheduled interview time. You may reschedule for any available open slot
            within the interview window.
          </span>
        </div>

        <!-- Completed Alert -->
        <div
          v-if="
            activeOrLatestReservation.status === 'COMPLETED' ||
            activeOrLatestReservation.status === 'CHECKED_OUT'
          "
          class="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2.5"
        >
          <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your grading interview is complete. You are now eligible to redeem resubmission passes
            for this assignment.
          </span>
        </div>

        <!-- Cancelled Alert -->
        <div
          v-if="activeOrLatestReservation.status === 'CANCELLED'"
          class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5"
        >
          <UIcon name="i-lucide-calendar-x" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            This interview reservation was cancelled. You may reschedule for any available open slot
            within the interview window.
          </span>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          <UButton
            v-if="activeOrLatestReservation.status === 'SCHEDULED'"
            color="primary"
            variant="outline"
            label="Reschedule Appointment"
            icon="i-lucide-calendar-clock"
            @click="isRescheduling = true"
          />
          <UButton
            v-if="activeOrLatestReservation.status === 'SCHEDULED'"
            color="error"
            variant="ghost"
            label="Cancel Reservation"
            icon="i-lucide-calendar-x"
            :loading="isCancelling"
            @click="handleCancel"
          />
          <UButton
            v-if="
              activeOrLatestReservation.status === 'MISSED' ||
              activeOrLatestReservation.status === 'CANCELLED'
            "
            color="primary"
            variant="solid"
            label="Reschedule Appointment"
            icon="i-lucide-calendar-clock"
            @click="isRescheduling = true"
          />
        </div>
      </div>

      <!-- Mode B: Progressive Narrowing Stepper -->
      <div v-else class="space-y-6">
        <!-- Stepper Indicator -->
        <div
          class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800"
        >
          <div class="flex items-center gap-2">
            <div v-for="s in [1, 2, 3]" :key="s" class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                :class="[
                  currentStep === s
                    ? 'bg-primary-600 text-white'
                    : currentStep > s
                      ? 'bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                ]"
              >
                <UIcon v-if="currentStep > s" name="i-lucide-check" class="w-4 h-4" />
                <span v-else>{{ s }}</span>
              </div>
              <div v-if="s < 3" class="w-8 h-0.5 bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
          <span class="text-xs font-medium text-neutral-500">
            Step {{ currentStep }} of 3: {{ stepTitle }}
          </span>
        </div>

        <!-- Step 1: Half-Day Block Selection -->
        <div v-if="currentStep === 1" class="space-y-4">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Select an available morning or afternoon period with open Graduate TA slots:
          </p>

          <div v-if="slotsStatus === 'pending'" class="py-12 flex justify-center">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary-500" />
          </div>

          <div v-else-if="!availableBlocks.length" class="p-6 text-center space-y-3">
            <div
              v-if="isRescheduling && activeOrLatestReservation"
              class="p-4 rounded-xl border border-primary-500/30 bg-primary-50/50 dark:bg-primary-950/30 text-left space-y-2"
            >
              <div
                class="flex items-center gap-2 text-primary-700 dark:text-primary-300 font-semibold text-sm"
              >
                <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-primary-500 shrink-0" />
                <span>Current Reservation Protected</span>
              </div>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">
                No alternative open slots were found within the assignment window. Your existing
                reservation for
                <strong class="text-neutral-800 dark:text-neutral-200">
                  {{
                    formatReservationTime(
                      activeOrLatestReservation.startTime,
                      activeOrLatestReservation.endTime
                    )
                  }}
                </strong>
                with
                <strong class="text-neutral-800 dark:text-neutral-200">
                  {{ formatGtaName(activeOrLatestReservation.gta) }}
                </strong>
                remains active.
              </p>
            </div>
            <div v-else class="space-y-2 py-4">
              <UIcon
                name="i-lucide-calendar-off"
                class="w-10 h-10 mx-auto text-neutral-400 opacity-60"
              />
              <p class="font-medium text-sm text-neutral-700 dark:text-neutral-300">
                No Open Interview Slots
              </p>
              <p class="text-xs text-neutral-400 max-w-sm mx-auto">
                There are currently no open Graduate TA slots within the assignment's interview
                window. Please check back soon as GTAs post shifts.
              </p>
            </div>
          </div>

          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1"
          >
            <button
              v-for="block in availableBlocks"
              :key="blockKey(block)"
              type="button"
              class="p-4 rounded-xl border text-left transition-all cursor-pointer space-y-3 relative overflow-hidden"
              :class="[
                selectedBlock && blockKey(selectedBlock) === blockKey(block)
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 ring-2 ring-primary-500'
                  : isBlockHighDemand(block)
                    ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-400 dark:hover:border-amber-700'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              ]"
              @click="selectBlock(block)"
            >
              <!-- Top Row: Block Title & Date -->
              <div class="flex items-start justify-between gap-2">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <p class="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {{ getBlockLabel(block) }}
                    </p>
                    <UBadge
                      v-if="block.isCurrentBlock"
                      color="success"
                      variant="subtle"
                      size="xs"
                      class="animate-pulse"
                    >
                      In Progress
                    </UBadge>
                  </div>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ getBlockDateLabel(block) }} • {{ getBlockTimeRangeLabel(block) }}
                  </p>
                </div>

                <!-- High Demand / Capacity Badge -->
                <UBadge
                  v-if="isBlockHighDemand(block)"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  class="shrink-0 flex items-center gap-1 font-semibold"
                >
                  <UIcon name="i-lucide-flame" class="w-3.5 h-3.5 text-amber-500" />
                  <span>High Demand</span>
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="xs" class="shrink-0">
                  {{ getOpenSlotsCount(block) }} slot{{ getOpenSlotsCount(block) === 1 ? '' : 's' }}
                  open
                </UBadge>
              </div>

              <!-- Utilization Progress & Metric -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs">
                  <span
                    :class="[
                      isBlockHighDemand(block)
                        ? 'font-semibold text-amber-600 dark:text-amber-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                    ]"
                  >
                    {{ getUtilizationPercentage(block) }}% full
                  </span>
                  <span class="text-neutral-400 text-[11px]">
                    {{ getBookedSlotsCount(block) }} / {{ getTotalSlotsCount(block) }} booked
                  </span>
                </div>
                <div
                  class="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full rounded-full transition-all"
                    :class="[
                      getUtilizationPercentage(block) < 50
                        ? 'bg-green-500'
                        : getUtilizationPercentage(block) <= 60
                          ? 'bg-emerald-500'
                          : getUtilizationPercentage(block) <= 75
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                    ]"
                    :style="{ width: `${getUtilizationPercentage(block)}%` }"
                  />
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2: 10-Minute Timeslot Selection -->
        <div v-else-if="currentStep === 2 && selectedBlock" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-semibold text-neutral-500">Selected Period</p>
              <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {{ getBlockLabel(selectedBlock) }}
              </p>
            </div>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              label="Change Period"
              icon="i-lucide-arrow-left"
              @click="currentStep = 1"
            />
          </div>

          <p class="text-xs text-neutral-500">
            Select an exact 10-minute slot (5-minute interview with Graduate TA + 5-minute buffer).
          </p>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
            <button
              v-for="slot in selectedBlock.slots"
              :key="slot.startTime"
              type="button"
              class="p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1"
              :class="[
                selectedSlot?.startTime === slot.startTime
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold ring-2 ring-primary-500/20'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-primary-400 text-neutral-800 dark:text-neutral-200'
              ]"
              @click="selectSlot(slot)"
            >
              <span class="text-xs font-semibold">
                {{ formatSlotTime(slot.startTime) }}
              </span>
              <span class="text-[10px] text-neutral-500 font-medium">
                {{ slot.capacity ?? slot.availableGtaCount }} TA{{
                  (slot.capacity ?? slot.availableGtaCount) === 1 ? '' : 's'
                }}
                open
              </span>
            </button>
          </div>
        </div>

        <!-- Step 3: Review & Confirm -->
        <div v-else-if="currentStep === 3 && selectedSlot" class="space-y-4">
          <div
            class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-3"
          >
            <div class="space-y-0.5">
              <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Appointment Summary
              </span>
              <p class="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {{ assignment?.title || 'Grading Interview' }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <p class="text-neutral-500 font-medium">Date & Time</p>
                <p class="font-semibold text-neutral-800 dark:text-neutral-200">
                  {{ formatReservationTime(selectedSlot.startTime, selectedSlot.endTime) }}
                </p>
              </div>

              <div>
                <p class="text-neutral-500 font-medium">Duration</p>
                <p class="font-semibold text-neutral-800 dark:text-neutral-200">5 minutes</p>
              </div>

              <div class="sm:col-span-2">
                <p class="text-neutral-500 font-medium">Meeting Location</p>
                <p class="font-semibold text-neutral-800 dark:text-neutral-200">
                  {{ effectiveLocation }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="p-3.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 text-xs text-neutral-600 dark:text-neutral-300 flex items-start gap-2.5"
          >
            <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
            <span>
              An on-duty Graduate TA will be automatically assigned to your appointment upon
              confirmation.
            </span>
          </div>

          <div class="flex items-center justify-between pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              label="Back"
              icon="i-lucide-arrow-left"
              @click="currentStep = 2"
            />
            <UButton
              color="primary"
              label="Confirm Interview Booking"
              icon="i-lucide-calendar-check"
              :loading="isBooking"
              @click="handleConfirmBooking"
            />
          </div>
        </div>

        <div
          v-if="isRescheduling && activeOrLatestReservation"
          class="pt-2 border-t border-neutral-200 dark:border-neutral-800"
        >
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            label="Cancel Rescheduling & View Existing Appointment"
            @click="isRescheduling = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AssignmentRow } from '@@/shared/models/assignment'
import type {
  GtaInterviewHalfDayBlockDto,
  GtaInterviewSlotDto,
  GtaInterviewReservationDto
} from '@@/shared/schemas/gta-interview.schema'
import { useGtaInterviewStudent } from '~/composables/features/useGtaInterviewStudent'

const props = defineProps<{
  courseId: string
  assignment: AssignmentRow | null
  existingReservation?: GtaInterviewReservationDto | null
  interviewLocation?: string | null
}>()

const emit = defineEmits<{
  (e: 'reserved', reservation: GtaInterviewReservationDto): void
  (e: 'cancelled'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const assignmentId = computed(() => props.assignment?.id || '')
const {
  slotsData,
  slotsStatus,
  refreshSlots,
  myReservation,
  refreshReservation,
  isBooking,
  isCancelling,
  bookSlot,
  cancelReservation
} = useGtaInterviewStudent(
  computed(() => props.courseId),
  assignmentId
)

const activeOrLatestReservation = computed(() => {
  return myReservation.value || props.existingReservation || null
})

const effectiveLocation = computed(() => {
  return (
    slotsData.value?.interviewLocation ||
    props.interviewLocation ||
    'Designated GTA Interview Location'
  )
})

const availableBlocks = computed(() => {
  return slotsData.value?.blocks || []
})

// Wizard navigation state
const currentStep = ref(1)
const selectedBlock = ref<GtaInterviewHalfDayBlockDto | null>(null)
const selectedSlot = ref<GtaInterviewSlotDto | null>(null)
const isRescheduling = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    currentStep.value = 1
    selectedBlock.value = null
    selectedSlot.value = null
    isRescheduling.value = false
    refreshSlots()
    refreshReservation()
  }
})

const modalTitle = computed(() => {
  if (activeOrLatestReservation.value && !isRescheduling.value) {
    return 'Grading Interview Appointment'
  }
  return 'Schedule GTA Grading Interview'
})

const modalDescription = computed(() => {
  if (activeOrLatestReservation.value && !isRescheduling.value) {
    return 'View, reschedule, or cancel your 1-on-1 interview with a Graduate TA.'
  }
  return 'Reserve a 1-on-1 timeslot with an on-duty Graduate TA for assignment grading.'
})

const stepTitle = computed(() => {
  switch (currentStep.value) {
    case 1:
      return 'Half-Day Period'
    case 2:
      return 'Time Slot'
    case 3:
      return 'Confirm Booking'
    default:
      return ''
  }
})

const blockKey = (b: GtaInterviewHalfDayBlockDto) =>
  b.id || `${b.date}-${b.blockType || b.halfDay || 'period'}`

const getBlockLabel = (block: GtaInterviewHalfDayBlockDto) => {
  return block.label || block.blockLabel || 'Interview Period'
}

const getBlockDateLabel = (block: GtaInterviewHalfDayBlockDto) => {
  if (block.dateLabel) return block.dateLabel
  if (!block.date) return ''
  const parts = block.date.split('-')
  if (parts.length === 3) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ]
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    if (m >= 0 && m < 12) {
      return `${months[m]} ${d}`
    }
  }
  return block.date
}

const getBlockTimeRangeLabel = (block: GtaInterviewHalfDayBlockDto) => {
  if (block.timeRangeLabel) return block.timeRangeLabel
  const isMorning =
    block.blockType === 'MORNING' || block.halfDay === 'MORNING' || block.period === 'morning'
  return isMorning ? 'Morning (Before 12:30 PM)' : 'Afternoon (12:30 PM & Later)'
}

const getOpenSlotsCount = (block: GtaInterviewHalfDayBlockDto): number => {
  if (typeof block.openSlotsCount === 'number') return block.openSlotsCount
  if (typeof block.availableSlotsCount === 'number') return block.availableSlotsCount
  return block.slots?.length || 0
}

const getTotalSlotsCount = (block: GtaInterviewHalfDayBlockDto): number => {
  if (typeof block.totalSlotsCount === 'number') return block.totalSlotsCount
  if (typeof block.totalCapacity === 'number') return block.totalCapacity
  return getOpenSlotsCount(block)
}

const getBookedSlotsCount = (block: GtaInterviewHalfDayBlockDto): number => {
  const total = getTotalSlotsCount(block)
  const open = getOpenSlotsCount(block)
  return Math.max(0, total - open)
}

const getUtilizationPercentage = (block: GtaInterviewHalfDayBlockDto): number => {
  if (typeof block.utilizationPercentage === 'number') return block.utilizationPercentage
  const total = getTotalSlotsCount(block)
  const open = getOpenSlotsCount(block)
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((total - open) / total) * 100)))
}

const isBlockHighDemand = (block: GtaInterviewHalfDayBlockDto): boolean => {
  if (typeof block.isHighDemand === 'boolean') return block.isHighDemand
  return getUtilizationPercentage(block) > 60
}

const selectBlock = (block: GtaInterviewHalfDayBlockDto) => {
  selectedBlock.value = block
  currentStep.value = 2
}

const selectSlot = (slot: GtaInterviewSlotDto) => {
  selectedSlot.value = slot
  currentStep.value = 3
}

const handleConfirmBooking = async () => {
  if (!selectedSlot.value) return
  try {
    const rescheduleId =
      isRescheduling.value && activeOrLatestReservation.value?.status === 'SCHEDULED'
        ? activeOrLatestReservation.value.id
        : undefined
    const res = rescheduleId
      ? await bookSlot(selectedSlot.value.startTime, rescheduleId)
      : await bookSlot(selectedSlot.value.startTime)
    emit('reserved', res)
    isRescheduling.value = false
  } catch {
    // Toast handled in composable
  }
}

const handleCancel = async () => {
  if (!activeOrLatestReservation.value) return
  try {
    await cancelReservation(activeOrLatestReservation.value.id)
    emit('cancelled')
  } catch {
    // Toast handled in composable
  }
}

const statusBadgeColor = (status: string) => {
  switch (status) {
    case 'SCHEDULED':
      return 'primary'
    case 'CHECKED_IN':
      return 'info'
    case 'COMPLETED':
    case 'CHECKED_OUT':
      return 'success'
    case 'MISSED':
      return 'error'
    case 'CANCELLED':
      return 'warning'
    default:
      return 'neutral'
  }
}

const formatGtaName = (gta?: {
  firstName: string | null
  lastName: string | null
  email: string
}) => {
  if (!gta) return 'Graduate TA'
  const full = `${gta.firstName || ''} ${gta.lastName || ''}`.trim()
  return full || gta.email
}

const formatReservationTime = (startStr: string, endStr: string) => {
  const s = new Date(startStr)
  const e = new Date(endStr)
  const dateStr = s.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const startT = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endT = e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${dateStr}, ${startT} – ${endT}`
}

const formatSlotTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
</script>
