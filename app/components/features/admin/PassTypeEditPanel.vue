<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? $t('admin.passType.panelTitleEdit') : $t('admin.passType.panelTitleCreate')"
    :description="panelDescription"
  >
    <template #body>
      <UForm ref="formRef" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <BaseFormInput
            v-model="state.name"
            name="name"
            :label="$t('admin.passType.nameLabel')"
            :placeholder="$t('admin.passType.namePlaceholder')"
            required
          />
          <BaseFormInput
            v-model="state.description"
            name="description"
            :label="$t('admin.passType.descriptionLabel')"
            :placeholder="$t('admin.passType.descriptionPlaceholder')"
          />

          <BaseFormInput
            v-model="state.titlePattern"
            name="titlePattern"
            :label="$t('admin.passType.titlePatternLabel')"
            :placeholder="$t('admin.passType.titlePatternPlaceholder')"
            :description="$t('admin.passType.titlePatternDescription')"
          />

          <div class="grid grid-cols-2 gap-4">
            <BaseFormInput
              v-model.number="state.initialBalance"
              name="initialBalance"
              :label="$t('admin.passType.initialBalanceLabel')"
              type="number"
              min="0"
            />
            <BaseFormInput
              v-model.number="state.hoursPerPass"
              name="hoursPerPass"
              :label="$t('admin.passType.hoursPerPassLabel')"
              type="number"
              step="0.5"
              min="0"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <BaseFormInput
              v-model.number="state.minDaysPastDue"
              name="minDaysPastDue"
              :label="$t('admin.passType.minDaysPastDueLabel')"
              type="number"
              min="0"
              :placeholder="$t('admin.passType.nonePlaceholder')"
            />
            <BaseFormInput
              v-model.number="state.maxDaysPastDue"
              name="maxDaysPastDue"
              :label="$t('admin.passType.maxDaysPastDueLabel')"
              type="number"
              min="0"
              :placeholder="$t('admin.passType.nonePlaceholder')"
            />
          </div>

          <div class="border-t pt-4">
            <h3 class="text-sm font-semibold mb-3">
              {{ $t('admin.passType.coolDownSettingsTitle') }}
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <BaseFormInput
                v-model.number="state.coolDownPeriod"
                name="coolDownPeriod"
                :label="$t('admin.passType.periodLabel')"
                type="number"
                min="0"
                :placeholder="$t('admin.passType.nonePlaceholder')"
              />
              <UFormField :label="$t('admin.passType.unitLabel')" name="coolDownUnit">
                <USelect
                  v-model="state.coolDownUnit"
                  :items="['HOUR', 'DAY', 'WEEK']"
                  :placeholder="$t('admin.passType.nonePlaceholder')"
                />
              </UFormField>
              <UFormField :label="$t('admin.passType.resetLabel')" name="coolDownReset">
                <USelect
                  v-model="state.coolDownReset"
                  :items="['HOUR', 'DAY', 'WEEK']"
                  :placeholder="$t('admin.passType.nonePlaceholder')"
                />
              </UFormField>
              <BaseFormInput
                v-model.number="state.coolDownResetOffset"
                name="coolDownResetOffset"
                :label="$t('admin.passType.resetOffsetLabel')"
                type="number"
                min="0"
                :placeholder="$t('admin.passType.nonePlaceholder')"
              />
            </div>
            <p class="text-xs text-neutral-500 mt-2">
              {{ $t('admin.passType.coolDownDescription') }}
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <UFormField
              :label="$t('admin.passType.extensionOnlyLabel')"
              :description="$t('admin.passType.extensionOnlyDescription')"
            >
              <USwitch v-model="state.extensionOnly" />
            </UFormField>

            <UFormField
              :label="$t('admin.passType.allowRequestsLabel')"
              :description="$t('admin.passType.allowRequestsDescription')"
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
          :label="$t('global.actions.cancel')"
          icon="i-lucide-x"
          :disabled="saving"
          @click="open = false"
        />
        <UButton
          color="primary"
          :label="isEdit ? $t('global.actions.save') : $t('global.actions.submit')"
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
const { t } = useI18n()

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
  return t('admin.passType.panelDescriptionCreate')
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
  coolDownPeriod: undefined as any,
  coolDownUnit: undefined as string | undefined,
  coolDownReset: undefined as string | undefined,
  coolDownResetOffset: undefined as any
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
      state.coolDownPeriod = passType.coolDownPeriod ?? undefined
      state.coolDownUnit = passType.coolDownUnit ?? undefined
      state.coolDownReset = passType.coolDownReset ?? undefined
      state.coolDownResetOffset = passType.coolDownResetOffset ?? undefined
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
      state.coolDownPeriod = undefined
      state.coolDownUnit = undefined
      state.coolDownReset = undefined
      state.coolDownResetOffset = undefined
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
      coolDownPeriod: state.coolDownPeriod ? Number(state.coolDownPeriod) : null,
      coolDownUnit: (state.coolDownUnit as 'HOUR' | 'DAY' | 'WEEK' | undefined) ?? null,
      coolDownReset: (state.coolDownReset as 'HOUR' | 'DAY' | 'WEEK' | undefined) ?? null,
      coolDownResetOffset: state.coolDownResetOffset ? Number(state.coolDownResetOffset) : null
    }

    if (isEdit.value) {
      await $fetch(`/api/me/pass-types/${props.passType!.id}`, {
        method: 'PATCH',
        body
      })
      success({
        title: t('admin.passType.notifications.updatedTitle'),
        message: t('admin.passType.notifications.updatedMessage')
      })
      emit('saved', props.passType!.id, body)
    } else {
      await $fetch('/api/me/pass-types', {
        method: 'POST',
        body
      })
      success({
        title: t('admin.passType.notifications.createdTitle'),
        message: t('admin.passType.notifications.createdMessage')
      })
      emit('created')
    }
    open.value = false
  } catch (err: any) {
    showError({
      title: isEdit.value
        ? t('admin.passType.notifications.updateFailedTitle')
        : t('admin.passType.notifications.createFailedTitle'),
      message: err?.data?.message || t('admin.passType.notifications.errorDefault')
    })
  } finally {
    saving.value = false
  }
}
</script>
