<template>
  <UModal
    v-model:open="open"
    title="Course Settings"
    description="Configure course-wide options for grading interviews, test center scheduling, and staffing."
  >
    <template #body>
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
            GTA Interview Meeting Location
          </label>
          <p class="text-xs text-neutral-500 mb-3">
            The physical room or online video meeting link where students meet with Graduate TAs for
            grading interviews (e.g., "McBryde Hall 106" or a Zoom URL).
          </p>
          <UInput
            v-model="location"
            placeholder="e.g. McBryde Hall 106 / Zoom Link"
            icon="i-lucide-map-pin"
            class="w-full"
          />
        </div>

        <div
          class="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2.5"
        >
          <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
          <span>
            All Graduate TA interviews for this course will share this meeting location by default.
            Students will see this location in their confirmation and calendar reminders.
          </span>
        </div>

        <div class="border-t border-neutral-200 dark:border-neutral-800 pt-5 space-y-5">
          <div>
            <h4 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1 flex items-center gap-2">
              <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-primary-500" />
              Automated Assignment Feature Matching
            </h4>
            <p class="text-xs text-neutral-500">
              Specify regular expression patterns to automatically enable CBTF scheduling or Graduate
              TA interviews whenever assignments are created or synced from Canvas.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
              CBTF Scheduling Title Pattern
            </label>
            <p class="text-xs text-neutral-500 mb-2">
              Case-insensitive regex against assignment titles (e.g., <code class="text-primary-600 dark:text-primary-400">^Exam\s[0-9]+|Midterm|Final</code>).
            </p>
            <UInput
              v-model="cbtfPattern"
              placeholder="e.g. ^Exam\s[0-9]+|Midterm|Final"
              icon="i-lucide-binary"
              class="w-full font-mono text-sm"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
              GTA Interview Title Pattern
            </label>
            <p class="text-xs text-neutral-500 mb-2">
              Case-insensitive regex against assignment titles (e.g., <code class="text-primary-600 dark:text-primary-400">^Project\s[0-9]+|Milestone</code>).
            </p>
            <UInput
              v-model="interviewPattern"
              placeholder="e.g. ^Project\s[0-9]+|Milestone"
              icon="i-lucide-binary"
              class="w-full font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          color="primary"
          label="Save Settings"
          icon="i-lucide-check"
          :loading="saving"
          @click="handleSave"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useCourseContext } from '~/composables/features/useCourseContext'

const props = defineProps<{
  courseId: string
  initialLocation?: string | null
  initialCbtfTitlePattern?: string | null
  initialInterviewTitlePattern?: string | null
}>()

const emit = defineEmits<{
  (
    e: 'saved',
    settings: {
      location: string | null
      cbtfTitlePattern: string | null
      interviewTitlePattern: string | null
    }
  ): void
}>()

const open = defineModel<boolean>('open', { default: false })
const location = ref(props.initialLocation ?? '')
const cbtfPattern = ref(props.initialCbtfTitlePattern ?? '')
const interviewPattern = ref(props.initialInterviewTitlePattern ?? '')
const saving = ref(false)
const toast = useToast()
const { updateCourseSettings } = useCourseContext()

const stopSyncWatch = watch(
  [
    () => props.initialLocation,
    () => props.initialCbtfTitlePattern,
    () => props.initialInterviewTitlePattern,
    open
  ],
  ([newLoc, newCbtf, newInterview, isOpen]) => {
    if (isOpen) {
      location.value = newLoc ?? ''
      cbtfPattern.value = newCbtf ?? ''
      interviewPattern.value = newInterview ?? ''
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  stopSyncWatch()
})

const handleSave = async () => {
  if (!props.courseId) return

  saving.value = true
  try {
    const trimmedLoc = location.value.trim()
    const trimmedCbtf = cbtfPattern.value.trim()
    const trimmedInterview = interviewPattern.value.trim()

    const res = await updateCourseSettings(props.courseId, {
      interviewLocation: trimmedLoc || null,
      cbtfTitlePattern: trimmedCbtf || null,
      interviewTitlePattern: trimmedInterview || null
    })

    toast.add({
      title: 'Course Settings Saved',
      description: 'Course settings and assignment patterns have been updated.',
      color: 'success'
    })

    emit('saved', {
      location: res?.data?.interviewLocation ?? (trimmedLoc || null),
      cbtfTitlePattern: res?.data?.cbtfTitlePattern ?? (trimmedCbtf || null),
      interviewTitlePattern: res?.data?.interviewTitlePattern ?? (trimmedInterview || null)
    })
    open.value = false
  } catch (err: any) {
    toast.add({
      title: 'Failed to Save',
      description: err?.data?.statusMessage || err?.message || 'Could not update course settings.',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>
