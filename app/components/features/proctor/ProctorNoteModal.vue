<template>
  <UModal :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <div class="p-5 space-y-5">
      <!-- Modal Header -->
      <div
        class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800"
      >
        <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <UIcon name="i-lucide-file-warning" class="w-5 h-5 flex-shrink-0" />
          <h2 class="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Log Incident / Proctor Note
          </h2>
        </div>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <!-- Target Selection / Display -->
      <div
        v-if="targetDisplay"
        class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between"
      >
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-neutral-900 dark:text-neutral-100">
              {{ targetDisplay.studentName || 'Active Test Taker' }}
            </span>
            <span
              v-if="targetDisplay.seatNumber"
              class="px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-mono font-bold text-xs"
            >
              Seat #{{ targetDisplay.seatNumber }}
            </span>
          </div>
          <p v-if="targetDisplay.assignmentTitle" class="text-xs text-neutral-500">
            {{ targetDisplay.assignmentTitle }}
          </p>
        </div>
        <UButton
          v-if="allowTargetChange"
          size="xs"
          variant="ghost"
          color="neutral"
          label="Change"
          @click="resetSelectedTarget"
        />
      </div>

      <!-- Target Chooser (when opened generally without pre-selection) -->
      <div v-else class="space-y-3">
        <div class="flex items-center gap-4 text-xs font-semibold">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="selectMode" type="radio" value="seat" class="text-primary-600" />
            <span>Select by Workstation Seat</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="selectMode" type="radio" value="student" class="text-primary-600" />
            <span>Select by Student Name</span>
          </label>
        </div>

        <!-- By Seat Selection -->
        <div v-if="selectMode === 'seat'" class="space-y-1">
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Workstation Seat Number:
          </label>
          <USelect
            v-model="chosenSeat"
            :items="seatOptions"
            placeholder="Select occupied seat..."
            size="sm"
            class="w-full"
          />
        </div>

        <!-- By Student Selection -->
        <div v-else class="space-y-1">
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Student Name:
          </label>
          <USelect
            v-model="chosenReservationId"
            :items="studentOptions"
            placeholder="Select student..."
            size="sm"
            class="w-full"
          />
        </div>
      </div>

      <!-- Previous Notes for this session (if any) -->
      <div v-if="existingNotes.length > 0" class="space-y-2">
        <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          Previous Notes This Session ({{ existingNotes.length }}):
        </span>
        <div
          class="max-h-36 overflow-y-auto space-y-2 p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs"
        >
          <div
            v-for="(n, idx) in existingNotes"
            :key="idx"
            class="space-y-1 pb-2 border-b border-neutral-200/60 dark:border-neutral-700/60 last:border-0 last:pb-0"
          >
            <div class="flex items-center justify-between text-neutral-500 font-mono text-[11px]">
              <span>{{ n.authorName || 'Proctor' }} • {{ formatNoteTime(n.createdAt) }}</span>
              <span v-if="n.hasPhotos" class="text-red-600 dark:text-red-400 font-bold font-sans">
                [Photo Taken]
              </span>
            </div>
            <p class="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
              {{ n.content }}
            </p>
          </div>
        </div>
      </div>

      <!-- New Note Text Input -->
      <div class="space-y-1.5">
        <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          Observation / Incident Details:
        </label>
        <UTextarea
          v-model="content"
          rows="4"
          placeholder="Describe factual observations, unauthorized materials (notes, phone), browser tabs, or test room irregularities..."
          class="w-full text-sm font-sans"
          autofocus
        />
      </div>

      <!-- Photo Checkbox -->
      <div
        class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1"
      >
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input
            v-model="hasPhotos"
            type="checkbox"
            class="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
          />
          <div class="text-xs">
            <span class="font-bold text-amber-900 dark:text-amber-200"
              >Picture(s) taken on proctor device</span
            >
            <p class="text-amber-700 dark:text-amber-300/80 text-[11px] mt-0.5">
              Check this box if you captured photo evidence on your phone. An automated email will
              alert the course instructor and CBTF manager at checkout so they can contact you for
              the photo(s).
            </p>
          </div>
        </label>
      </div>

      <!-- Modal Actions -->
      <div
        class="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="$emit('update:modelValue', false)"
        />
        <UButton
          size="sm"
          color="warning"
          icon="i-lucide-save"
          label="Save Note"
          :loading="saving"
          :disabled="!isSubmittable"
          @click="handleSubmit"
        />
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  target?: {
    reservationId?: string
    seatNumber?: number
    studentName?: string
    assignmentTitle?: string
    notes?: any[]
  } | null
  seatedRoster: any[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'submit',
    payload: {
      reservationId?: string
      seatNumber?: number
      content: string
      hasPhotos: boolean
    }
  ): void
}>()

const selectMode = ref<'seat' | 'student'>('seat')
const chosenSeat = ref<number | null>(null)
const chosenReservationId = ref<string | null>(null)
const content = ref('')
const hasPhotos = ref(false)
const saving = ref(false)
const allowTargetChange = ref(false)

const targetDisplay = computed(() => {
  if (props.target) {
    return props.target
  }
  if (selectMode.value === 'seat' && chosenSeat.value) {
    const match = props.seatedRoster.find((r) => r.seatNumber === chosenSeat.value)
    return match
      ? {
          reservationId: match.id,
          seatNumber: match.seatNumber,
          studentName: match.studentName,
          assignmentTitle: match.assignmentTitle,
          notes: match.notes
        }
      : { seatNumber: chosenSeat.value }
  }
  if (selectMode.value === 'student' && chosenReservationId.value) {
    const match = props.seatedRoster.find((r) => r.id === chosenReservationId.value)
    return match
      ? {
          reservationId: match.id,
          seatNumber: match.seatNumber,
          studentName: match.studentName,
          assignmentTitle: match.assignmentTitle,
          notes: match.notes
        }
      : null
  }
  return null
})

const existingNotes = computed(() => {
  return targetDisplay.value?.notes || []
})

const seatOptions = computed(() => {
  return props.seatedRoster.map((r) => ({
    label: `Seat #${r.seatNumber} — ${r.studentName || 'Student'} (${r.assignmentTitle || 'Exam'})`,
    value: r.seatNumber
  }))
})

const studentOptions = computed(() => {
  return props.seatedRoster.map((r) => ({
    label: `${r.studentName || 'Student'} (Seat #${r.seatNumber}) — ${r.assignmentTitle || 'Exam'}`,
    value: r.id
  }))
})

const isSubmittable = computed(() => {
  if (!content.value.trim()) return false
  if (props.target?.reservationId || props.target?.seatNumber) return true
  if (selectMode.value === 'seat' && chosenSeat.value) return true
  if (selectMode.value === 'student' && chosenReservationId.value) return true
  return false
})

const resetSelectedTarget = () => {
  chosenSeat.value = null
  chosenReservationId.value = null
  allowTargetChange.value = false
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      content.value = ''
      hasPhotos.value = false
      saving.value = false
      if (props.target?.seatNumber) {
        chosenSeat.value = props.target.seatNumber
        allowTargetChange.value = false
      } else if (props.target?.reservationId) {
        chosenReservationId.value = props.target.reservationId
        allowTargetChange.value = false
      } else {
        chosenSeat.value = props.seatedRoster[0]?.seatNumber ?? null
        chosenReservationId.value = props.seatedRoster[0]?.id ?? null
        allowTargetChange.value = true
      }
    }
  }
)

const formatNoteTime = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const handleSubmit = () => {
  if (!isSubmittable.value) return
  saving.value = true

  const payload: {
    reservationId?: string
    seatNumber?: number
    content: string
    hasPhotos: boolean
  } = {
    content: content.value.trim(),
    hasPhotos: hasPhotos.value
  }

  if (props.target?.reservationId) {
    payload.reservationId = props.target.reservationId
  } else if (props.target?.seatNumber) {
    payload.seatNumber = props.target.seatNumber
  } else if (selectMode.value === 'seat' && chosenSeat.value) {
    payload.seatNumber = chosenSeat.value
  } else if (selectMode.value === 'student' && chosenReservationId.value) {
    payload.reservationId = chosenReservationId.value
  }

  emit('submit', payload)
}
</script>
