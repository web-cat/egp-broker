<template>
  <UModal
    v-model:open="open"
    :title="modalTitle"
    :description="modalDescription"
    :ui="{ content: 'max-w-xl' }"
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
            @update:model-value="onAssignmentChange"
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
            @update:model-value="onPassTypeChange"
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
          @click="open = false"
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
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInput,
  parseDateTimeInput
} from '@@/shared/utils/timezone'
import type {
  StudentRosterRow,
  StudentPassBalance
} from '@@/shared/models/teacher'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { usePassRedemptions } from '~/composables/features/usePassRedemptions'

const props = withDefaults(
  defineProps<{
    student: StudentRosterRow | null
    assignments?: AssignmentRow[]
  }>(),
  {
    assignments: () => []
  }
)

const emit = defineEmits<{
  redeemed: [balances: StudentPassBalance[]]
}>()

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { forceRedeemStudentPass } = usePassRedemptions()

const rawSelectedAssignmentId = ref('')
const rawSelectedPassTypeId = ref('')
const rawStartDate = ref('')
const rawEndDate = ref('')
const deductFromBalance = ref(true)
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
  return props.assignments?.find((a) => a.id === rawSelectedAssignmentId.value) || null
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
  return applicablePassTypes.value.find((pt) => pt.id === rawSelectedPassTypeId.value) || null
})

const durationHours = computed(() => {
  return selectedPassType.value?.hoursPerPass || 24
})

const selectedAssignmentId = computed({
  get: () => rawSelectedAssignmentId.value,
  set: (val: string) => {
    rawSelectedAssignmentId.value = val
    if (!val) {
      selectedPassTypeId.value = ''
      return
    }

    const available = applicablePassTypes.value
    if (available.length > 0) {
      const match = available.find((pt) => pt.id === rawSelectedPassTypeId.value)
      if (!match) {
        selectedPassTypeId.value = available[0].id
      }
    } else {
      selectedPassTypeId.value = ''
    }
  }
})

const selectedPassTypeId = computed({
  get: () => rawSelectedPassTypeId.value,
  set: (val: string) => {
    rawSelectedPassTypeId.value = val
    if (val) {
      updateEndDateForPassType(val)
    }
  }
})

const startDate = computed({
  get: () => rawStartDate.value,
  set: (val: string) => {
    rawStartDate.value = val
    if (val && rawSelectedPassTypeId.value) {
      updateEndDateForPassType(rawSelectedPassTypeId.value)
    }
  }
})

const endDate = computed({
  get: () => rawEndDate.value,
  set: (val: string) => {
    rawEndDate.value = val
  }
})

const canSubmit = computed(() => {
  return (
    Boolean(rawSelectedAssignmentId.value) &&
    Boolean(rawSelectedPassTypeId.value) &&
    Boolean(rawStartDate.value) &&
    Boolean(rawEndDate.value) &&
    !isSubmitting.value
  )
})

function toDateTimeLocalString(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatDateTimeInput(date, timeZone)
}

function parseDateTimeLocalInput(value: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return parseDateTimeInput(value, timeZone) || new Date().toISOString()
}

function updateEndDateForPassType(passTypeId: string) {
  const pt = applicablePassTypes.value.find((p) => p.id === passTypeId)
  if (pt) {
    const startIso = rawStartDate.value
      ? parseDateTimeLocalInput(rawStartDate.value)
      : new Date().toISOString()
    const startMs = new Date(startIso).getTime()
    const hours = pt.hoursPerPass || 24
    const end = new Date(startMs + hours * 3600 * 1000)
    rawEndDate.value = toDateTimeLocalString(end)
  }
}

function calculateDefaultDates(hours: number) {
  const now = new Date()
  rawStartDate.value = toDateTimeLocalString(now)
  const end = new Date(now.getTime() + hours * 3600 * 1000)
  rawEndDate.value = toDateTimeLocalString(end)
}

function resetForm() {
  rawSelectedAssignmentId.value = ''
  rawSelectedPassTypeId.value = ''
  deductFromBalance.value = true
  calculateDefaultDates(24)
}

const stopSyncWatch = watch(
  [() => props.student, open],
  ([student, isOpen]) => {
    if (isOpen && student) {
      resetForm()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  stopSyncWatch()
})

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

    const res = await forceRedeemStudentPass(props.student.userId, payload)

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
      open.value = false
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
