<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :description="modalDescription"
    :ui="{ content: 'max-w-xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Assignment Selector -->
        <UFormField
          label="Assignment"
          required
          help="Choose the assignment for which the pass will be redeemed."
        >
          <USelect
            v-model="selectedAssignmentId"
            :items="assignmentOptions"
            placeholder="Select an assignment…"
            class="w-full"
            :disabled="isSubmitting"
          />
        </UFormField>

        <!-- Pass Type Selector -->
        <UFormField
          label="Pass Type"
          required
          :help="
            selectedAssignment
              ? applicablePassTypes.length
                ? 'Select among pass type(s) configured for this assignment.'
                : 'No pass types configured for this assignment.'
              : 'Select an assignment first.'
          "
        >
          <USelect
            v-model="selectedPassTypeId"
            :items="passTypeOptions"
            :placeholder="
              selectedAssignment
                ? applicablePassTypes.length
                  ? 'Select a pass type…'
                  : 'No applicable pass types'
                : 'Select an assignment first'
            "
            class="w-full"
            :disabled="isSubmitting || !selectedAssignmentId || applicablePassTypes.length === 0"
          />
        </UFormField>

        <!-- Balance Deduction Toggle -->
        <div
          class="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60"
        >
          <div class="space-y-0.5 pr-4">
            <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Deduct from Pass Balance
            </p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              {{
                deductFromBalance
                  ? "Deducts 1 pass from the student's pool balance."
                  : "Grants extension without deducting from the student's pass balance."
              }}
            </p>
          </div>
          <USwitch v-model="deductFromBalance" :disabled="isSubmitting" />
        </div>

        <!-- Start & End Date Inputs -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField
            label="Start Date (Available From)"
            help="Defaults to now (Eastern Time)."
          >
            <UInput
              v-model="startDate"
              type="datetime-local"
              class="w-full"
              :disabled="isSubmitting"
            />
          </UFormField>

          <UFormField
            label="End Date (Deadline & Lock)"
            help="Defaults to start + pass duration (Eastern Time)."
          >
            <UInput
              v-model="endDate"
              type="datetime-local"
              class="w-full"
              :disabled="isSubmitting"
            />
          </UFormField>
        </div>

        <!-- Sync Preview Banner -->
        <div
          v-if="selectedAssignment && selectedPassType"
          class="p-3 rounded-md bg-primary-50/60 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 text-xs text-primary-900 dark:text-primary-200 space-y-1"
        >
          <div class="flex items-center gap-1.5 font-semibold">
            <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span>Redemption Summary</span>
          </div>
          <p>
            Duration: <strong>{{ durationHours }} hour{{ durationHours === 1 ? '' : 's' }}</strong>.
            All times are interpreted in <strong>Eastern Time (America/New_York)</strong>.
            <span v-if="selectedAssignment.toolSupportsPassport">
              Communicates extension directly to connected external tool (PassPort).
            </span>
            <span v-else-if="selectedAssignment.canvasAssignmentId">
              Creates or updates individual student override in Canvas with title:
              <code>[EGP Pass] {{ selectedPassType.name }}</code>.
            </span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="isSubmitting"
          @click="$emit('update:open', false)"
        />
        <UButton
          label="Redeem Pass"
          color="primary"
          icon="i-lucide-ticket-check"
          :loading="isSubmitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  DEFAULT_TIMEZONE,
  getLocalDateString,
  getLocalTimeParts,
  combineDateAndTime
} from '@@/shared/utils/timezone'
import type {
  StudentRosterRow,
  StudentPassBalance,
  TeacherForceRedeemPassResponse
} from '@@/shared/models/teacher'
import type { AssignmentRow } from '@@/shared/models/assignment'
import type { ApiResponse } from '@@/shared/types/api'

const props = withDefaults(
  defineProps<{
    open: boolean
    student: StudentRosterRow | null
    assignments?: AssignmentRow[]
  }>(),
  {
    assignments: () => []
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  redeemed: [balances: StudentPassBalance[]]
}>()

const toast = useToast()

const selectedAssignmentId = ref('')
const selectedPassTypeId = ref('')
const deductFromBalance = ref(true)
const startDate = ref('')
const endDate = ref('')
const isSubmitting = ref(false)

const modalTitle = computed(() => {
  return props.student ? `Redeem Pass: ${props.student.studentName}` : 'Redeem Pass'
})

const modalDescription = computed(() => {
  if (!props.student) return 'Forcibly redeem a pass for this student.'
  const email = props.student.studentEmail || 'No email'
  return `Forcibly redeem a pass for ${props.student.studentName} (${email}).`
})

// Assignment Options
const assignmentOptions = computed(() => {
  return (props.assignments || []).map((a) => ({
    label: a.title || 'Untitled Assignment',
    value: a.id
  }))
})

const selectedAssignment = computed(() => {
  return props.assignments?.find((a) => a.id === selectedAssignmentId.value) || null
})

// Applicable Pass Types for the selected assignment (unfiltered by min/max days!)
const applicablePassTypes = computed(() => {
  return selectedAssignment.value?.eligiblePassTypes || []
})

const passTypeOptions = computed(() => {
  return applicablePassTypes.value.map((pt) => ({
    label: `${pt.name} (${pt.hoursPerPass || 24}h extension)`,
    value: pt.id
  }))
})

const selectedPassType = computed(() => {
  return applicablePassTypes.value.find((pt) => pt.id === selectedPassTypeId.value) || null
})

const durationHours = computed(() => {
  return selectedPassType.value?.hoursPerPass || 24
})

const canSubmit = computed(() => {
  return (
    Boolean(selectedAssignmentId.value) &&
    Boolean(selectedPassTypeId.value) &&
    Boolean(startDate.value) &&
    Boolean(endDate.value) &&
    !isSubmitting.value
  )
})

function toDateTimeLocalString(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const dateStr = getLocalDateString(date, timeZone)
  const parts = getLocalTimeParts(date, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dateStr}T${pad(parts.hour24)}:${pad(parts.minute)}`
}

function parseDateTimeLocalInput(value: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!value) return new Date().toISOString()
  const [dateStr, timePart] = value.split('T')
  const timeStr = timePart ? timePart.slice(0, 5) : '00:00'
  return combineDateAndTime(dateStr, timeStr, timeZone).toISOString()
}

function calculateDefaultDates(hours: number) {
  const now = new Date()
  startDate.value = toDateTimeLocalString(now)
  const end = new Date(now.getTime() + hours * 3600 * 1000)
  endDate.value = toDateTimeLocalString(end)
}

// Watch modal opening
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selectedAssignmentId.value = ''
      selectedPassTypeId.value = ''
      deductFromBalance.value = true
      calculateDefaultDates(24)
    }
  },
  { immediate: true }
)

// When assignment changes, update selected pass type
watch(
  () => selectedAssignmentId.value,
  (newAssignmentId) => {
    if (!newAssignmentId) {
      selectedPassTypeId.value = ''
      return
    }

    const available = applicablePassTypes.value
    if (available.length > 0) {
      const match = available.find((pt) => pt.id === selectedPassTypeId.value)
      if (!match) {
        selectedPassTypeId.value = available[0].id
      }
    } else {
      selectedPassTypeId.value = ''
    }
  }
)

// When pass type changes, recalculate default end date based on duration
watch(
  () => selectedPassTypeId.value,
  () => {
    if (selectedPassType.value) {
      const startIso = startDate.value
        ? parseDateTimeLocalInput(startDate.value)
        : new Date().toISOString()
      const startMs = new Date(startIso).getTime()
      const hours = selectedPassType.value.hoursPerPass || 24
      const end = new Date(startMs + hours * 3600 * 1000)
      endDate.value = toDateTimeLocalString(end)
    }
  }
)

async function handleSubmit() {
  if (!props.student?.userId || !canSubmit.value) return

  isSubmitting.value = true
  try {
    const payload = {
      assignmentId: selectedAssignmentId.value,
      passTypeId: selectedPassTypeId.value,
      deductFromBalance: deductFromBalance.value,
      availableFrom: startDate.value
        ? parseDateTimeLocalInput(startDate.value)
        : new Date().toISOString(),
      dueDate: endDate.value ? parseDateTimeLocalInput(endDate.value) : null,
      acceptUntil: endDate.value ? parseDateTimeLocalInput(endDate.value) : null
    }

    const res = await $fetch<ApiResponse<TeacherForceRedeemPassResponse>>(
      `/api/me/students/${props.student.userId}/redemptions`,
      {
        method: 'POST',
        body: payload
      }
    )

    if (res.data) {
      toast.add({
        title: 'Pass Redeemed',
        description: `Successfully redeemed ${selectedPassType.value?.name || 'pass'} for ${props.student.studentName}.`,
        color: 'success'
      })

      if (res.data.warning) {
        toast.add({
          title: 'Canvas Override Notice',
          description: res.data.warning,
          color: 'warning'
        })
      }

      emit('redeemed', res.data.passBalances)
      emit('update:open', false)
    }
  } catch (err: unknown) {
    const error = err as { data?: { message?: string; statusMessage?: string }; message?: string }
    toast.add({
      title: 'Failed to Redeem Pass',
      description:
        error.data?.message ||
        error.data?.statusMessage ||
        error.message ||
        'An error occurred while redeeming the pass',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>
