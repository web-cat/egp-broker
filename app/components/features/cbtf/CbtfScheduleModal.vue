<template>
  <UModal v-model:open="open" :title="modalTitle" :description="modalDescription">
    <template #body>
      <!-- Mode A: Active / Missed Reservation View -->
      <div v-if="existingReservation && !isRescheduling" class="space-y-6">
        <div
          class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-4"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Current Reservation
            </span>
            <UBadge
              :color="statusBadgeColor(existingReservation.status)"
              variant="subtle"
              size="sm"
            >
              {{ existingReservation.status }}
            </UBadge>
          </div>

          <div class="space-y-1">
            <p class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {{ assignment?.title || existingReservation.assignmentTitle }}
            </p>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{
                formatReservationTime(existingReservation.startTime, existingReservation.endTime)
              }}
            </p>
          </div>

          <div
            class="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800"
          >
            <UIcon name="i-lucide-armchair" class="w-5 h-5 text-primary-500" />
            <span class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Workstation Seat #{{ existingReservation.seatNumber }}
            </span>
          </div>
        </div>

        <div
          v-if="existingReservation.status === 'MISSED'"
          class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2"
        >
          <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0 mt-0.5" />
          <span
            >You missed your scheduled exam time. You may reschedule for an open slot within the
            test window.</span
          >
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          <UButton
            v-if="existingReservation.status === 'SCHEDULED'"
            color="error"
            variant="ghost"
            label="Cancel Reservation"
            icon="i-lucide-calendar-x"
            :loading="cancelling"
            @click="handleCancel"
          />
          <UButton
            color="primary"
            variant="solid"
            label="Reschedule Exam"
            icon="i-lucide-calendar-clock"
            @click="startRescheduling"
          />
        </div>
      </div>

      <!-- Mode B: Progressive Narrowing Wizard (Stepper) -->
      <div v-else class="space-y-6">
        <!-- Stepper Indicator -->
        <div
          class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800"
        >
          <div class="flex items-center gap-2">
            <div v-for="s in [1, 2, 3, 4]" :key="s" class="flex items-center gap-2">
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
              <div v-if="s < 4" class="w-6 h-0.5 bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
          <span class="text-xs font-medium text-neutral-500">
            Step {{ currentStep }} of 4: {{ stepTitle }}
          </span>
        </div>

        <!-- Loading State -->
        <div v-if="loadingAvailability" class="py-12 text-center space-y-3">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 mx-auto animate-spin text-primary-500" />
          <p class="text-sm text-neutral-500">Finding available testing center slots…</p>
        </div>

        <!-- Success Screen (Post-Confirmation) -->
        <div v-else-if="confirmedReservation" class="py-8 text-center space-y-4">
          <div
            class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto"
          >
            <UIcon name="i-lucide-check-circle-2" class="w-10 h-10" />
          </div>
          <div>
            <h4 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Exam Confirmed!
            </h4>
            <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {{
                formatReservationTime(confirmedReservation.startTime, confirmedReservation.endTime)
              }}
            </p>
          </div>

          <div
            class="p-4 rounded-xl border border-primary-500/30 bg-primary-50/50 dark:bg-primary-950/30 max-w-sm mx-auto"
          >
            <p
              class="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400"
            >
              Assigned Workstation
            </p>
            <p class="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
              Seat #{{ confirmedReservation.seatNumber }}
            </p>
            <p class="text-xs text-neutral-500 mt-2">
              Please arrive 5–10 minutes early with your student photo ID card.
            </p>
          </div>

          <UButton color="primary" label="Done" class="mt-4" @click="open = false" />
        </div>

        <!-- Wizard Step 1: Morning vs Afternoon -->
        <div v-else-if="currentStep === 1" class="space-y-4">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            What time of day do you prefer to take this test?
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              class="p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between"
              :class="[
                selectedPreference === 'morning'
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 ring-2 ring-primary-500'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              ]"
              @click="choosePreference('morning')"
            >
              <div class="flex items-center justify-between">
                <UIcon name="i-lucide-sun" class="w-8 h-8 text-amber-500" />
                <UIcon
                  v-if="selectedPreference === 'morning'"
                  name="i-lucide-check-circle"
                  class="w-5 h-5 text-primary-600"
                />
              </div>
              <div class="mt-4">
                <p class="font-bold text-base text-neutral-900 dark:text-neutral-100">Morning</p>
                <p class="text-xs text-neutral-500 mt-0.5">Slots starting before 12:00 PM</p>
              </div>
            </button>

            <button
              type="button"
              class="p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between"
              :class="[
                selectedPreference === 'afternoon'
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 ring-2 ring-primary-500'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              ]"
              @click="choosePreference('afternoon')"
            >
              <div class="flex items-center justify-between">
                <UIcon name="i-lucide-sunset" class="w-8 h-8 text-indigo-500" />
                <UIcon
                  v-if="selectedPreference === 'afternoon'"
                  name="i-lucide-check-circle"
                  class="w-5 h-5 text-primary-600"
                />
              </div>
              <div class="mt-4">
                <p class="font-bold text-base text-neutral-900 dark:text-neutral-100">Afternoon</p>
                <p class="text-xs text-neutral-500 mt-0.5">Slots starting 12:00 PM onwards</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Wizard Step 2: Recommended Days -->
        <div v-else-if="currentStep === 2" class="space-y-4">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            We recommend the following days based on testing center capacity and availability:
          </p>

          <div
            v-if="availabilityData?.recommendedDays.length === 0"
            class="p-6 text-center text-neutral-500 text-sm"
          >
            No open slots found for {{ selectedPreference }} within your test window. Try switching
            to the other time of day.
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="day in availabilityData?.recommendedDays"
              :key="day.date"
              type="button"
              class="p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2"
              :class="[
                selectedDate === day.date
                  ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 ring-2 ring-primary-500'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              ]"
              @click="chooseDate(day.date)"
            >
              <div class="flex items-center justify-between">
                <p class="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  {{ day.label }}
                </p>
                <UBadge color="primary" variant="subtle" size="xs">
                  {{ day.openSlotsCount }} slots
                </UBadge>
              </div>

              <div>
                <div class="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>Room utilization</span>
                  <span>{{ day.utilizationPercentage }}%</span>
                </div>
                <div
                  class="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full rounded-full transition-all"
                    :class="[
                      day.utilizationPercentage < 50
                        ? 'bg-green-500'
                        : day.utilizationPercentage < 80
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    ]"
                    :style="{ width: `${day.utilizationPercentage}%` }"
                  />
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Wizard Step 3: Hourly Slot Selection -->
        <div v-else-if="currentStep === 3" class="space-y-4">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Pick a time slot for <strong>{{ selectedDayLabel }}</strong
            >:
          </p>

          <div
            v-if="availabilityData?.hourlySlots.length === 0"
            class="p-6 text-center text-neutral-500 text-sm"
          >
            No open hourly slots found for this date.
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              v-for="slot in availabilityData?.hourlySlots"
              :key="slot.startTime"
              type="button"
              class="p-3 rounded-lg border text-center transition-all cursor-pointer font-medium text-sm flex flex-col items-center justify-center gap-1"
              :class="[
                selectedSlot?.startTime === slot.startTime
                  ? 'border-primary-500 bg-primary-600 text-white font-bold shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-900 dark:text-neutral-100'
              ]"
              @click="chooseSlot(slot)"
            >
              <UIcon name="i-lucide-clock" class="w-4 h-4" />
              <span>{{ slot.formattedTime }}</span>
            </button>
          </div>
        </div>

        <!-- Wizard Step 4: Review & Confirm -->
        <div v-else-if="currentStep === 4" class="space-y-4">
          <div
            class="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-3"
          >
            <div
              class="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800"
            >
              <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Reservation Summary
              </span>
              <UBadge color="neutral" variant="subtle" size="xs"> 60 Minutes Duration </UBadge>
            </div>

            <div class="space-y-1">
              <p class="text-xs text-neutral-500 uppercase">Assignment</p>
              <p class="font-bold text-neutral-900 dark:text-neutral-100">
                {{ assignment?.title || availabilityData?.assignmentTitle }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-1">
              <div>
                <p class="text-xs text-neutral-500 uppercase">Date</p>
                <p class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  {{ selectedDayLabel }}
                </p>
              </div>
              <div>
                <p class="text-xs text-neutral-500 uppercase">Time Slot</p>
                <p class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  {{ selectedSlot?.formattedTime }}
                </p>
              </div>
            </div>

            <div
              class="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-neutral-500"
            >
              <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-500 shrink-0" />
              <span>Workstation seat will be assigned deterministically upon confirmation.</span>
            </div>
          </div>
        </div>

        <!-- Wizard Footer Navigation -->
        <div
          v-if="!confirmedReservation"
          class="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800"
        >
          <UButton
            v-if="currentStep > 1"
            color="neutral"
            variant="ghost"
            label="Back"
            icon="i-lucide-arrow-left"
            @click="currentStep--"
          />
          <div v-else />

          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" label="Cancel" @click="open = false" />
            <UButton
              v-if="currentStep < 4"
              color="primary"
              label="Next"
              trailing-icon="i-lucide-arrow-right"
              :disabled="isNextDisabled"
              @click="currentStep++"
            />
            <UButton
              v-else
              color="primary"
              :label="isRescheduling ? 'Confirm Reschedule' : 'Confirm Reservation'"
              icon="i-lucide-check"
              :loading="booking"
              @click="handleConfirmBooking"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { AssignmentRow } from '@@/shared/models/assignment'
import type { CbtfReservationDto, CbtfHourlySlotChoice } from '@@/shared/models/cbtf'
import { useCbtfStudent, type CbtfAvailabilityData } from '~/composables/features/useCbtfStudent'

const props = defineProps<{
  assignment: AssignmentRow | null
  existingReservation?: CbtfReservationDto | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  reserved: [reservation: CbtfReservationDto]
  cancelled: []
}>()

const { fetchAvailability, createReservation, rescheduleReservation, cancelReservation } =
  useCbtfStudent()

// State
const isRescheduling = ref(false)
const currentStep = ref(1)
const loadingAvailability = ref(false)
const booking = ref(false)
const cancelling = ref(false)

const selectedPreference = ref<'morning' | 'afternoon'>('morning')
const selectedDate = ref<string>('')
const selectedSlot = ref<CbtfHourlySlotChoice | null>(null)
const availabilityData = ref<CbtfAvailabilityData | null>(null)
const confirmedReservation = ref<CbtfReservationDto | null>(null)

// Step titles
const stepTitle = computed(() => {
  switch (currentStep.value) {
    case 1:
      return 'Time of Day'
    case 2:
      return 'Select Day'
    case 3:
      return 'Pick Time Slot'
    case 4:
      return 'Confirm'
    default:
      return ''
  }
})

const modalTitle = computed(() => {
  if (props.existingReservation && !isRescheduling.value) {
    return 'CBTF Exam Reservation'
  }
  return isRescheduling.value ? 'Reschedule CBTF Exam' : 'Schedule CBTF Exam'
})

const modalDescription = computed(() => {
  return props.assignment?.title || 'Testing Center Reservation'
})

const selectedDayLabel = computed(() => {
  const day = availabilityData.value?.recommendedDays.find((d) => d.date === selectedDate.value)
  return day?.label || selectedDate.value
})

const isNextDisabled = computed(() => {
  if (currentStep.value === 1) return !selectedPreference.value
  if (currentStep.value === 2) return !selectedDate.value
  if (currentStep.value === 3) return !selectedSlot.value
  return false
})

// Load availability when opening or changing parameters
const loadAvailability = async () => {
  if (!props.assignment?.id) return
  loadingAvailability.value = true
  try {
    const data = await fetchAvailability(
      props.assignment.id,
      selectedPreference.value,
      selectedDate.value || undefined
    )
    availabilityData.value = data
    if (!selectedDate.value && data.recommendedDays.length > 0) {
      selectedDate.value = data.recommendedDays[0].date
    }
  } catch (err) {
    console.error(err)
  } finally {
    loadingAvailability.value = false
  }
}

const choosePreference = async (pref: 'morning' | 'afternoon') => {
  selectedPreference.value = pref
  selectedSlot.value = null
  selectedDate.value = ''
  currentStep.value = 2
  await loadAvailability()
}

const chooseDate = async (dateStr: string) => {
  selectedDate.value = dateStr
  selectedSlot.value = null
  currentStep.value = 3
  await loadAvailability()
}

const chooseSlot = (slot: CbtfHourlySlotChoice) => {
  selectedSlot.value = slot
  currentStep.value = 4
}

const startRescheduling = () => {
  isRescheduling.value = true
  currentStep.value = 1
  confirmedReservation.value = null
  loadAvailability()
}

const handleConfirmBooking = async () => {
  if (!props.assignment?.id || !selectedSlot.value) return
  booking.value = true
  try {
    let result: CbtfReservationDto
    if (isRescheduling.value && props.existingReservation?.id) {
      result = await rescheduleReservation(
        props.existingReservation.id,
        selectedSlot.value.startTime
      )
    } else {
      result = await createReservation(props.assignment.id, selectedSlot.value.startTime)
    }
    confirmedReservation.value = result
    emit('reserved', result)
  } catch (err) {
    console.error(err)
  } finally {
    booking.value = false
  }
}

const handleCancel = async () => {
  if (!props.existingReservation?.id) return
  if (!confirm('Are you sure you want to cancel this exam reservation?')) return
  cancelling.value = true
  try {
    await cancelReservation(props.existingReservation.id)
    emit('cancelled')
    open.value = false
  } catch (err) {
    console.error(err)
  } finally {
    cancelling.value = false
  }
}

const formatReservationTime = (startStr: string, endStr: string) => {
  const start = new Date(startStr)
  const end = new Date(endStr)
  return `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

const statusBadgeColor = (status: string) => {
  switch (status) {
    case 'SCHEDULED':
      return 'primary'
    case 'CHECKED_IN':
      return 'success'
    case 'CHECKED_OUT':
      return 'neutral'
    case 'MISSED':
      return 'error'
    default:
      return 'neutral'
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    confirmedReservation.value = null
    isRescheduling.value = false
    currentStep.value = 1
    selectedSlot.value = null
    selectedDate.value = ''
    if (!props.existingReservation) {
      loadAvailability()
    }
  }
})
</script>
