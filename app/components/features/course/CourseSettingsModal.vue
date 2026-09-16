<template>
  <UModal
    v-model:open="open"
    title="Course Settings"
    description="Configure course-wide options for grading interviews and staffing."
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

        <div class="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2.5">
          <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
          <span>
            All Graduate TA interviews for this course will share this meeting location by default. Students will see this location in their confirmation and calendar reminders.
          </span>
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
import { ref, watch } from 'vue'

const props = defineProps<{
  courseId: string
  initialLocation?: string | null
}>()

const emit = defineEmits<{
  (e: 'saved', location: string | null): void
}>()

const open = defineModel<boolean>('open', { default: false })
const location = ref(props.initialLocation ?? '')
const saving = ref(false)
const toast = useToast()

watch(
  () => props.initialLocation,
  (newLoc) => {
    location.value = newLoc ?? ''
  }
)

watch(open, (isOpen) => {
  if (isOpen) {
    location.value = props.initialLocation ?? ''
  }
})

const handleSave = async () => {
  if (!props.courseId) return

  saving.value = true
  try {
    const trimmed = location.value.trim()
    const res = await $fetch<{ data: { interviewLocation: string | null } }>(
      `/api/me/courses/${props.courseId}`,
      {
        method: 'PATCH',
        body: {
          interviewLocation: trimmed || null
        }
      }
    )

    toast.add({
      title: 'Course Settings Saved',
      description: 'The Graduate TA interview location has been updated.',
      color: 'success'
    })

    emit('saved', res?.data?.interviewLocation ?? (trimmed || null))
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
