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
          <BaseFormInput
            v-model="state.cbtfTitlePattern"
            name="cbtfTitlePattern"
            label="CBTF Assignment Pattern"
            placeholder="e.g. ^exam\b|midterm"
          />
          <BaseFormInput
            v-model="state.interviewTitlePattern"
            name="interviewTitlePattern"
            label="GTA Interview Assignment Pattern"
            placeholder="e.g. \binterview\b"
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
import { useAdminCourses } from '~/composables/features/admin/useAdminCourses'
const { success, error: showError } = useNotifications()

interface CourseData {
  id: string
  label: string | null
  title: string | null
  canvasCourseId?: string | null
  workflowState?: string | null
  cbtfTitlePattern?: string | null
  interviewTitlePattern?: string | null
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
      cbtfTitlePattern: string | null
      interviewTitlePattern: string | null
    }
  ]
  created: []
}>()

const open = defineModel<boolean>('open', { required: true })

const formRef = useTemplateRef('formRef')
const saving = ref(false)
const { createCourse, updateCourse } = useAdminCourses()

const isEdit = computed(() => !!props.course)
const panelDescription = computed(() => {
  if (isEdit.value) return props.course?.label || props.course?.title || 'Course'
  return 'Create a new course'
})

const state = reactive({
  label: '',
  title: '',
  canvasCourseId: '',
  workflowState: '',
  cbtfTitlePattern: '',
  interviewTitlePattern: ''
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
      state.cbtfTitlePattern = course.cbtfTitlePattern ?? ''
      state.interviewTitlePattern = course.interviewTitlePattern ?? ''
    } else if (isOpen && !course) {
      // Reset form for create mode
      state.label = ''
      state.title = ''
      state.canvasCourseId = ''
      state.workflowState = ''
      state.cbtfTitlePattern = ''
      state.interviewTitlePattern = ''
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  saving.value = true
  try {
    const payload = {
      label: state.label || null,
      title: state.title || null,
      canvasCourseId: state.canvasCourseId || null,
      workflowState: state.workflowState || null,
      cbtfTitlePattern: state.cbtfTitlePattern || null,
      interviewTitlePattern: state.interviewTitlePattern || null
    }

    if (isEdit.value) {
      await updateCourse(props.course!.id, payload)
      success({
        title: 'Course updated',
        message: 'The course has been saved successfully.'
      })
      emit('saved', props.course!.id, payload)
    } else {
      await createCourse(payload)
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
