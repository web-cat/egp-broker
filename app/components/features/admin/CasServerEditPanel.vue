<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? t('admin.casServer.panelTitleEdit') : t('admin.casServer.panelTitleCreate')"
    :description="isEdit ? '' : ''"
  >
    <template #body>
      <UForm
        :schema="isEdit ? updateCasServerSchema : createCasServerSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
        @error="onError"
      >
        <BaseFormInput
          v-model="state.name"
          name="name"
          :label="t('admin.casServer.nameLabel')"
          :placeholder="t('admin.casServer.namePlaceholder')"
          required
          autofocus
        />

        <BaseFormInput
          v-model="state.baseUrl"
          name="baseUrl"
          :label="t('admin.casServer.baseUrlLabel')"
          :placeholder="t('admin.casServer.baseUrlPlaceholder')"
          required
        />

        <UFormField
          :label="t('admin.casServer.versionLabel')"
          name="serviceValidateVersion"
          required
        >
          <USelect
            v-model="state.serviceValidateVersion"
            :items="versionOptions"
            placeholder="Select version"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-x-2 mt-6">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('global.actions.cancel')"
            @click="open = false"
          />
          <UButton
            type="submit"
            color="primary"
            :label="t('global.actions.save')"
            :loading="pending"
          />
        </div>
      </UForm>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { CasServerAdminRow } from '@@/shared/schemas/cas.schema'
import { createCasServerSchema, updateCasServerSchema } from '@@/shared/schemas/cas.schema'

const props = defineProps<{
  casServer: CasServerAdminRow | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'saved', id: string, updates: CasServerAdminRow): void
  (e: 'created'): void
  (e: 'update:open', value: boolean): void
}>()

const { t } = useI18n()
const pending = ref(false)

const isEdit = computed(() => !!props.casServer)

interface LocalCasServerState {
  name: string
  baseUrl: string
  serviceValidateVersion: '1.0' | '2.0' | '3.0'
}

const state = reactive<LocalCasServerState>({
  name: '',
  baseUrl: '',
  serviceValidateVersion: '2.0'
})

const { createCasServer, updateCasServer } = useAdminCasServers()

const versionOptions = [
  { label: 'CAS 1.0', value: '1.0' },
  { label: 'CAS 2.0 (Default)', value: '2.0' },
  { label: 'CAS 3.0', value: '3.0' }
]

watch(
  () => props.casServer,
  (server) => {
    if (server) {
      state.name = server.name
      state.baseUrl = server.baseUrl
      state.serviceValidateVersion = server.serviceValidateVersion
    } else {
      state.name = ''
      state.baseUrl = ''
      state.serviceValidateVersion = '2.0'
    }
  },
  { immediate: true }
)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.casServer) {
        state.name = props.casServer.name
        state.baseUrl = props.casServer.baseUrl
        state.serviceValidateVersion = props.casServer.serviceValidateVersion
      } else {
        state.name = ''
        state.baseUrl = ''
        state.serviceValidateVersion = '2.0'
      }
    }
  }
)

async function onSubmit() {
  pending.value = true
  try {
    if (isEdit.value && props.casServer) {
      const res = await updateCasServer(props.casServer.id, state)
      if (res.data) {
        emit('saved', props.casServer.id, res.data)
      }
      const toast = useToast()
      toast.add({
        title: t('admin.casServer.notifications.updatedTitle'),
        description: t('admin.casServer.notifications.updatedMessage')
      })
    } else {
      await createCasServer(state)
      emit('created')
      const toast = useToast()
      toast.add({
        title: t('admin.casServer.notifications.createdTitle'),
        description: t('admin.casServer.notifications.createdMessage')
      })
    }
    emit('update:open', false)
    open.value = false
  } catch (err: any) {
    console.error(err)
    const toast = useToast()
    toast.add({
      title: t('admin.casServer.notifications.errorDefault'),
      description: err.message,
      color: 'error'
    })
  } finally {
    pending.value = false
  }
}

function onError(event: any) {
  console.log('Form error:', event)
}
</script>
