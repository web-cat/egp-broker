<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Course' : 'Add Course'"
    :description="panelDescription"
  >
    <template #body>
      <UForm ref="formRef" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <BaseFormInput
            v-model="state.label"
            name="label"
            label="Course Code"
            placeholder="e.g. CS 101"
          />
          <BaseFormInput
            v-model="state.title"
            name="title"
            label="Title"
            placeholder="e.g. Introduction to Computer Science"
          />
          <BaseFormInput
            v-model="state.canvasCourseId"
            name="canvasCourseId"
            label="Canvas Course ID"
            placeholder="Optional"
          />
          <BaseFormInput
            v-model="state.workflowState"
            name="workflowState"
            label="Workflow State"
            placeholder="Optional"
          />
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end w-full">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          icon="i-lucide-x"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          color="primary"
          :label="isEdit ? 'Save' : 'Create'"
          :icon="isEdit ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="saving"
          :disabled="saving"
          @click="formRef?.submit()"
        />
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
const { success, error: showError } = useNotifications()

interface CourseData {
  id: string
  label: string | null
  title: string | null
  canvasCourseId?: string | null
  workflowState?: string | null
}

const props = defineProps<{
  course: CourseData | null
}>()

const emit = defineEmits<{
  saved: [
    id: string,
    updates: {
      label: string | null
      title: string | null
      canvasCourseId: string | null
      workflowState: string | null
    }
  ]
  created: []
}>()

const open = defineModel<boolean>('open', { required: true })

const formRef = useTemplateRef('formRef')
const saving = ref(false)

const isEdit = computed(() => !!props.course)
const panelDescription = computed(() => {
  if (isEdit.value) return props.course?.label || props.course?.title || 'Course'
  return 'Create a new course'
})

const state = reactive({
  label: '',
  title: '',
  canvasCourseId: '',
  workflowState: ''
})

// Sync form state when the course prop changes or the panel opens
watch(
  [() => props.course, open],
  ([course, isOpen]) => {
    if (isOpen && course) {
      state.label = course.label ?? ''
      state.title = course.title ?? ''
      state.canvasCourseId = course.canvasCourseId ?? ''
      state.workflowState = course.workflowState ?? ''
    } else if (isOpen && !course) {
      // Reset form for create mode
      state.label = ''
      state.title = ''
      state.canvasCourseId = ''
      state.workflowState = ''
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  saving.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/admin/courses/${props.course!.id}`, {
        method: 'PATCH',
        body: {
          label: state.label || null,
          title: state.title || null,
          canvasCourseId: state.canvasCourseId || null,
          workflowState: state.workflowState || null
        }
      })
      const updates = {
        label: state.label || null,
        title: state.title || null,
        canvasCourseId: state.canvasCourseId || null,
        workflowState: state.workflowState || null
      }
      success({
        title: 'Course updated',
        message: 'The course has been saved successfully.'
      })
      emit('saved', props.course!.id, updates)
    } else {
      await $fetch('/api/admin/courses', {
        method: 'POST',
        body: {
          label: state.label || null,
          title: state.title || null,
          canvasCourseId: state.canvasCourseId || null,
          workflowState: state.workflowState || null
        }
      })
      success({
        title: 'Course created',
        message: 'The new course has been created successfully.'
      })
      emit('created')
    }
    open.value = false
  } catch (err: any) {
    showError({
      title: isEdit.value ? 'Update failed' : 'Create failed',
      message: err?.data?.message || 'An unexpected error occurred.'
    })
  } finally {
    saving.value = false
  }
}
</script>
