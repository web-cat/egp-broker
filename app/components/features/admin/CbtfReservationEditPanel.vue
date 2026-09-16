<template>
  <USlideover
    v-model:open="open"
    title="Edit Reservation"
    description="Update seat assignment, time window, or reservation status."
  >
    <template #body>
      <div v-if="reservation" class="space-y-6">
        <!-- Student & Assignment Context Box -->
        <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Student</span>
            <span v-if="reservation.studentId" class="text-xs font-mono text-neutral-400">
              ID: {{ reservation.studentId }}
            </span>
          </div>
          <div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ reservation.studentName || 'Unknown Student' }}
          </div>
          <div v-if="reservation.studentEmail" class="text-xs text-neutral-500">
            {{ reservation.studentEmail }}
          </div>

          <div class="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span class="text-neutral-500">Assignment:</span>
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">
              {{ reservation.assignmentTitle || 'Standard Exam' }}
            </span>
          </div>
        </div>

        <!-- Form Fields -->
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <UFormField label="Status" name="status" help="Changing status to Cancelled removes the Canvas override.">
            <USelect
              v-model="formState.status"
              :items="statusOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Seat Number" name="seatNumber" required help="Designated seat inside the testing facility.">
            <UInput
              v-model.number="formState.seatNumber"
              type="number"
              min="1"
              max="500"
              placeholder="e.g. 12"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Start Time" name="startTime" required>
              <UInput
                v-model="formState.startTime"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>

            <UFormField label="End Time" name="endTime" required>
              <UInput
                v-model="formState.endTime"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Canvas Sync Notice -->
          <div
            v-if="formState.status === 'CANCELLED'"
            class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300"
          >
            <UIcon name="i-lucide-alert-triangle" class="w-4 h-4 shrink-0 mt-0.5" />
            <span>Marking this reservation as Cancelled will automatically delete the corresponding student assignment override in Canvas.</span>
          </div>

          <div
            v-else-if="reservation.canvasOverrideId"
            class="p-3 rounded-lg bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 flex items-start gap-2 text-xs text-primary-800 dark:text-primary-300"
          >
            <UIcon name="i-lucide-refresh-cw" class="w-4 h-4 shrink-0 mt-0.5" />
            <span>Canvas override active (#{{ reservation.canvasOverrideId }}). Updating start or end times will automatically update the unlock and due dates in Canvas.</span>
          </div>

          <div class="flex justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="open = false"
            />
            <UButton
              type="submit"
              label="Save Changes"
              icon="i-lucide-check"
              :loading="saving"
            />
          </div>
        </form>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { watch, reactive } from 'vue'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'
import type { CbtfAdminUpdateReservationInput } from '@@/shared/schemas/cbtf.schema'

const props = defineProps<{
  open: boolean
  reservation: CbtfReservationDto | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'save', payload: { id: string; data: CbtfAdminUpdateReservationInput }): void
}>()

const open = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const statusOptions = [
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Missed', value: 'MISSED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]

const formState = reactive({
  status: 'SCHEDULED',
  seatNumber: 1,
  startTime: '',
  endTime: ''
})

function toDateTimeLocalString(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  const yyyy = date.getFullYear()
  const MM = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

function fromDateTimeLocalString(localString: string): string {
  if (!localString) return ''
  return new Date(localString).toISOString()
}

watch(
  () => props.reservation,
  (res) => {
    if (res) {
      formState.status = res.status
      formState.seatNumber = res.seatNumber
      formState.startTime = toDateTimeLocalString(res.startTime)
      formState.endTime = toDateTimeLocalString(res.endTime)
    }
  },
  { immediate: true }
)

const handleSubmit = () => {
  if (!props.reservation) return

  const payload: CbtfAdminUpdateReservationInput = {
    status: formState.status as any,
    seatNumber: Number(formState.seatNumber),
    startTime: fromDateTimeLocalString(formState.startTime),
    endTime: fromDateTimeLocalString(formState.endTime)
  }

  emit('save', {
    id: props.reservation.id,
    data: payload
  })
}
</script>
