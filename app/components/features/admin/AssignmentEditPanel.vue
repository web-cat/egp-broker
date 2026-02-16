<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Assignment' : 'Add Assignment'"
    :description="panelDescription"
  >
    <template #body>
      <UForm ref="formRef" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <BaseFormInput
            v-model="state.title"
            name="title"
            label="Title"
            placeholder="e.g. Homework 1"
          />
          <BaseFormInput
            v-model="state.canvasAssignmentId"
            name="canvasAssignmentId"
            label="Canvas Assignment ID"
            placeholder="Optional"
          />
          <BaseFormInput
            v-model="state.dueDate"
            name="dueDate"
            label="Due Date"
            type="datetime-local"
          />
          <BaseFormInput
            v-model="state.availableFrom"
            name="availableFrom"
            label="Available From"
            type="datetime-local"
          />
          <BaseFormInput
            v-model="state.acceptUntil"
            name="acceptUntil"
            label="Accept Until"
            type="datetime-local"
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

interface AssignmentData {
  id: string
  title: string | null
  canvasAssignmentId: string | null
  dueDate: string | null
  availableFrom: string | null
  acceptUntil: string | null
}

const props = defineProps<{
  assignment: AssignmentData | null
  courseId?: string | null
}>()

const emit = defineEmits<{
  saved: [
    id: string,
    updates: {
      title: string | null
      canvasAssignmentId: string | null
      dueDate: string | null
      availableFrom: string | null
      acceptUntil: string | null
    }
  ]
  created: []
}>()

const open = defineModel<boolean>('open', { required: true })

const formRef = useTemplateRef('formRef')
const saving = ref(false)

const isEdit = computed(() => !!props.assignment)
const panelDescription = computed(() => {
  if (isEdit.value) return props.assignment?.title || 'Assignment'
  return 'Create a new assignment'
})

const state = reactive({
  title: '',
  canvasAssignmentId: '',
  dueDate: '',
  availableFrom: '',
  acceptUntil: ''
})

function toLocalDatetime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Sync form state when the assignment prop changes or the panel opens
watch(
  [() => props.assignment, open],
  ([assignment, isOpen]) => {
    if (isOpen && assignment) {
      state.title = assignment.title ?? ''
      state.canvasAssignmentId = assignment.canvasAssignmentId ?? ''
      state.dueDate = toLocalDatetime(assignment.dueDate)
      state.availableFrom = toLocalDatetime(assignment.availableFrom)
      state.acceptUntil = toLocalDatetime(assignment.acceptUntil)
    } else if (isOpen && !assignment) {
      state.title = ''
      state.canvasAssignmentId = ''
      state.dueDate = ''
      state.availableFrom = ''
      state.acceptUntil = ''
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  saving.value = true
  try {
    const body = {
      title: state.title || null,
      canvasAssignmentId: state.canvasAssignmentId || null,
      dueDate: state.dueDate ? new Date(state.dueDate).toISOString() : null,
      availableFrom: state.availableFrom ? new Date(state.availableFrom).toISOString() : null,
      acceptUntil: state.acceptUntil ? new Date(state.acceptUntil).toISOString() : null
    }

    if (isEdit.value) {
      await $fetch(`/api/admin/assignments/${props.assignment!.id}`, {
        method: 'PATCH',
        body
      })
      success({
        title: 'Assignment updated',
        message: 'The assignment has been saved successfully.'
      })
      emit('saved', props.assignment!.id, body)
    } else {
      if (!props.courseId) {
        showError({
          title: 'Validation error',
          message: 'No course selected for this assignment.'
        })
        return
      }
      await $fetch('/api/admin/assignments', {
        method: 'POST',
        body: { ...body, courseId: props.courseId }
      })
      success({
        title: 'Assignment created',
        message: 'The new assignment has been created successfully.'
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
