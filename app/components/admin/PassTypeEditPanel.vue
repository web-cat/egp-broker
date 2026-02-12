<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Pass Type' : 'Add Pass Type'"
    :description="panelDescription"
  >
    <template #body>
      <UForm ref="formRef" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <UiFormInput
            v-model="state.name"
            name="name"
            label="Name"
            placeholder="e.g. Quiz Retry Pass"
            required
          />
          <UiFormInput
            v-model="state.description"
            name="description"
            label="Description"
            placeholder="Optional teacher-facing note"
          />

          <UiFormInput
            v-model="state.titlePattern"
            name="titlePattern"
            label="Assignment Title Pattern"
            placeholder="e.g. Lab %, Homework *"
            description="Use % or * as wildcard characters to match multiple assignments."
          />

          <div class="grid grid-cols-2 gap-4">
            <UiFormInput
              v-model.number="state.initialBalance"
              name="initialBalance"
              label="Initial Balance"
              type="number"
              min="0"
            />
            <UiFormInput
              v-model.number="state.hoursPerPass"
              name="hoursPerPass"
              label="Hours per Pass"
              type="number"
              step="0.5"
              min="0"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UiFormInput
              v-model.number="state.minDaysPastDue"
              name="minDaysPastDue"
              label="Min Days Past Due"
              type="number"
              placeholder="None"
            />
            <UiFormInput
              v-model.number="state.maxDaysPastDue"
              name="maxDaysPastDue"
              label="Max Days Past Due"
              type="number"
              placeholder="None"
            />
          </div>

          <div class="border-t pt-4">
            <h3 class="text-sm font-semibold mb-3">Cool Down Settings</h3>
            <div class="grid grid-cols-3 gap-4">
              <UiFormInput
                v-model.number="state.coolDownPeriod"
                name="coolDownPeriod"
                label="Period"
                type="number"
                min="0"
                placeholder="None"
              />
              <UFormField label="Unit" name="coolDownUnit">
                <USelect
                  v-model="state.coolDownUnit"
                  :items="['HOUR', 'DAY', 'WEEK']"
                  placeholder="None"
                />
              </UFormField>
              <UFormField label="Reset" name="coolDownReset">
                <USelect
                  v-model="state.coolDownReset"
                  :items="['HOUR', 'DAY', 'WEEK']"
                  placeholder="None"
                />
              </UFormField>
            </div>
            <p class="text-xs text-neutral-500 mt-2">
              Limits how often students can request this pass type.
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <UFormField
              label="Extension Only"
              description="Can this pass only be used for extensions?"
            >
              <USwitch v-model="state.extensionOnly" />
            </UFormField>

            <UFormField
              label="Allow Requests"
              description="Can students request more of these passes?"
            >
              <USwitch v-model="state.allowRequests" />
            </UFormField>
          </div>
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
import type { PassTypeData } from '@@/shared/models/pass'

const { success, error: showError } = useNotifications()

const props = defineProps<{
  passType: PassTypeData | null
}>()

const emit = defineEmits<{
  saved: [id: string, updates: Partial<PassTypeData>]
  created: []
}>()

const open = defineModel<boolean>('open', { required: true })

const formRef = useTemplateRef('formRef')
const saving = ref(false)

const isEdit = computed(() => !!props.passType)
const panelDescription = computed(() => {
  if (isEdit.value) return props.passType?.name || 'Pass Type'
  return 'Create a new pass type configuration'
})

const state = reactive({
  name: '',
  description: '',
  titlePattern: '',
  initialBalance: 3,
  hoursPerPass: 24,
  extensionOnly: false,
  allowRequests: false,
  minDaysPastDue: null as number | null,
  maxDaysPastDue: null as number | null,
  coolDownPeriod: null as number | null,
  coolDownUnit: null as string | null,
  coolDownReset: null as string | null
})

// Sync form state when the passType prop changes or the panel opens
watch(
  [() => props.passType, open],
  ([passType, isOpen]: [PassTypeData | null, boolean]) => {
    if (isOpen && passType) {
      state.name = passType.name
      state.description = passType.description ?? ''
      state.titlePattern = passType.titlePattern ?? ''
      state.initialBalance = passType.initialBalance
      state.hoursPerPass = passType.hoursPerPass
      state.extensionOnly = passType.extensionOnly
      state.allowRequests = passType.allowRequests
      state.minDaysPastDue = passType.minDaysPastDue
      state.maxDaysPastDue = passType.maxDaysPastDue
      state.coolDownPeriod = passType.coolDownPeriod
      state.coolDownUnit = passType.coolDownUnit
      state.coolDownReset = passType.coolDownReset
    } else if (isOpen && !passType) {
      state.name = ''
      state.description = ''
      state.titlePattern = ''
      state.initialBalance = 3
      state.hoursPerPass = 24
      state.extensionOnly = false
      state.allowRequests = false
      state.minDaysPastDue = null
      state.maxDaysPastDue = null
      state.coolDownPeriod = null
      state.coolDownUnit = null
      state.coolDownReset = null
    }
  },
  { immediate: true }
)

const handleSubmit = async () => {
  saving.value = true
  try {
    const body = {
      name: state.name,
      description: state.description || null,
      titlePattern: state.titlePattern || null,
      initialBalance: state.initialBalance,
      hoursPerPass: state.hoursPerPass,
      extensionOnly: state.extensionOnly,
      allowRequests: state.allowRequests,
      minDaysPastDue: state.minDaysPastDue,
      maxDaysPastDue: state.maxDaysPastDue,
      coolDownPeriod: state.coolDownPeriod,
      coolDownUnit: state.coolDownUnit,
      coolDownReset: state.coolDownReset
    }

    if (isEdit.value) {
      await $fetch(`/api/me/pass-types/${props.passType!.id}`, {
        method: 'PATCH',
        body
      })
      success({
        title: 'Pass Type updated',
        message: 'The configuration has been saved successfully.'
      })
      emit('saved', props.passType!.id, body)
    } else {
      await $fetch('/api/me/pass-types', {
        method: 'POST',
        body
      })
      success({
        title: 'Pass Type created',
        message: 'the new pass type has been created successfully.'
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
