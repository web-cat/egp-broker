<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseNoticesInput } from '@@/shared/utils/notice-parser'
import type { BatchUpsertNoticesResult } from '@@/shared/schemas/assignment-notice.schema'
import type { ApiResponse } from '@@/shared/types/api'

interface AssignmentOption {
  id: string
  title?: string | null
  hasInterviews?: boolean
}

const props = defineProps<{
  open: boolean
  courseId: string
  initialAssignmentId?: string
  assignments?: AssignmentOption[]
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'uploaded', result: BatchUpsertNoticesResult): void
}>()

const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const loadingAssignments = ref(false)
const availableAssignments = ref<AssignmentOption[]>([])
const selectedAssignmentId = ref<string>('')
const rawTextInput = ref('')
const isSubmitting = ref(false)
const uploadResult = ref<BatchUpsertNoticesResult | null>(null)
const errorMessage = ref<string | null>(null)

const parsedItems = computed(() => parseNoticesInput(rawTextInput.value))

const assignmentSelectItems = computed(() => {
  return availableAssignments.value.map((a) => ({
    label: a.title || 'Untitled Assignment',
    value: a.id
  }))
})

const fetchAssignments = async () => {
  if (props.assignments && props.assignments.length > 0) {
    availableAssignments.value = props.assignments
    if (!selectedAssignmentId.value) {
      selectedAssignmentId.value = props.initialAssignmentId || props.assignments[0]?.id || ''
    }
    return
  }

  if (!props.courseId) return
  loadingAssignments.value = true
  try {
    const res = await $fetch<ApiResponse<AssignmentOption[]>>(
      `/api/me/courses/${props.courseId}/assignments`
    )
    availableAssignments.value = res.data || []
    if (!selectedAssignmentId.value && availableAssignments.value.length > 0) {
      selectedAssignmentId.value =
        props.initialAssignmentId || availableAssignments.value[0]?.id || ''
    }
  } catch (err: any) {
    console.error('Failed to load assignments for notice upload:', err)
  } finally {
    loadingAssignments.value = false
  }
}

watch(
  () => props.open,
  (newOpen) => {
    if (newOpen) {
      uploadResult.value = null
      errorMessage.value = null
      fetchAssignments()
    }
  },
  { immediate: true }
)

const handleBatchUpload = async () => {
  if (!selectedAssignmentId.value) {
    errorMessage.value = 'Please select an assignment.'
    return
  }

  if (parsedItems.value.length === 0) {
    errorMessage.value = 'Please enter at least one valid student notice.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = null
  uploadResult.value = null

  try {
    const res = await $fetch<ApiResponse<BatchUpsertNoticesResult>>(
      `/api/me/courses/${props.courseId}/assignments/${selectedAssignmentId.value}/notices/batch`,
      {
        method: 'POST',
        body: {
          notices: parsedItems.value
        }
      }
    )

    uploadResult.value = res.data
    toast.add({
      title: 'Notices Uploaded',
      description: `Successfully processed ${res.data.totalProcessed} notice(s): ${res.data.createdCount} created, ${res.data.updatedCount} updated.`,
      color: 'success'
    })
    emit('uploaded', res.data)
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage || err?.message || 'Failed to upload staff notices.'
    toast.add({
      title: 'Upload Failed',
      description: errorMessage.value || 'Failed to upload notices.',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleClear = () => {
  rawTextInput.value = ''
  uploadResult.value = null
  errorMessage.value = null
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Upload Course Staff Notices"
    description="Upload internal grading notices and guidance for students in bulk (CSV, TSV, or JSON) to display on TA interview cards."
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
        >
          <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Success Summary Banner -->
        <div
          v-if="uploadResult"
          class="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-xs space-y-2"
        >
          <div class="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
            <UIcon name="i-lucide-check-circle-2" class="w-4 h-4" />
            <span>Upload Completed Successfully</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
            <div class="p-2 rounded bg-white/60 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900">
              <span class="block text-xs text-neutral-500 font-sans">Total</span>
              <span class="font-bold text-sm">{{ uploadResult.totalProcessed }}</span>
            </div>
            <div class="p-2 rounded bg-white/60 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900">
              <span class="block text-xs text-neutral-500 font-sans">Created</span>
              <span class="font-bold text-sm text-emerald-600 dark:text-emerald-400">{{ uploadResult.createdCount }}</span>
            </div>
            <div class="p-2 rounded bg-white/60 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900">
              <span class="block text-xs text-neutral-500 font-sans">Updated</span>
              <span class="font-bold text-sm text-blue-600 dark:text-blue-400">{{ uploadResult.updatedCount }}</span>
            </div>
            <div class="p-2 rounded bg-white/60 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900">
              <span class="block text-xs text-neutral-500 font-sans">Unmatched</span>
              <span class="font-bold text-sm" :class="uploadResult.unmatchedIdentifiers.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500'">
                {{ uploadResult.unmatchedIdentifiers.length }}
              </span>
            </div>
          </div>
          <div
            v-if="uploadResult.unmatchedIdentifiers.length > 0"
            class="pt-1 text-xs text-amber-800 dark:text-amber-300"
          >
            <p class="font-semibold">Unmatched student identifiers (not found in course enrollment):</p>
            <p class="font-mono text-[11px] truncate">{{ uploadResult.unmatchedIdentifiers.join(', ') }}</p>
          </div>
        </div>

        <!-- Assignment Selection -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
            Target Assignment
          </label>
          <div v-if="loadingAssignments" class="text-xs text-neutral-400 flex items-center gap-1.5 py-1">
            <UIcon name="i-lucide-loader-2" class="w-3.5 h-3.5 animate-spin" />
            Loading course assignments...
          </div>
          <USelect
            v-else
            v-model="selectedAssignmentId"
            :items="assignmentSelectItems"
            placeholder="Select assignment..."
            class="w-full"
          />
        </div>

        <!-- Input Box -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
              Notices (CSV, TSV, or JSON)
            </label>
            <span class="text-xs text-neutral-400">
              Format: <code>email/studentId, notice text</code>
            </span>
          </div>
          <UTextarea
            v-model="rawTextInput"
            rows="6"
            placeholder="alice@illinois.edu, Check problem 2 edge cases and recursion limit&#10;bob@illinois.edu, Verified manual test outputs"
            class="w-full font-mono text-xs"
          />
        </div>

        <!-- Live Parsed Preview -->
        <div v-if="parsedItems.length > 0" class="space-y-2">
          <div class="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span class="font-semibold flex items-center gap-1.5">
              <UIcon name="i-lucide-table" class="w-3.5 h-3.5 text-primary-500" />
              Preview ({{ parsedItems.length }} notice{{ parsedItems.length === 1 ? '' : 's' }} parsed)
            </span>
            <UButton
              variant="link"
              color="neutral"
              size="xs"
              label="Clear"
              @click="handleClear"
            />
          </div>

          <div class="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs divide-y divide-neutral-100 dark:divide-neutral-800">
            <div
              v-for="(item, idx) in parsedItems.slice(0, 50)"
              :key="idx"
              class="p-2 flex items-start gap-2 bg-neutral-50/50 dark:bg-neutral-900/50"
            >
              <span class="font-mono font-medium text-neutral-800 dark:text-neutral-200 shrink-0">
                {{ item.studentIdentifier }}
              </span>
              <span class="text-neutral-400 shrink-0">:</span>
              <span class="text-neutral-600 dark:text-neutral-400 truncate">
                {{ item.notice }}
              </span>
            </div>
            <div
              v-if="parsedItems.length > 50"
              class="p-2 text-center text-[11px] text-neutral-400 italic bg-neutral-50/20 dark:bg-neutral-900/20"
            >
              ...and {{ parsedItems.length - 50 }} more notices
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          label="Cancel"
          @click="isOpen = false"
        />
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-upload"
          :loading="isSubmitting"
          :disabled="parsedItems.length === 0 || !selectedAssignmentId || isSubmitting"
          label="Upload Notices"
          @click="handleBatchUpload"
        />
      </div>
    </template>
  </UModal>
</template>
