<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Platform' : 'Add Platform'"
    :description="panelDescription"
  >
    <template #body>
      <UForm :schema="schema" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <BaseFormInput
            v-model="state.name"
            name="name"
            label="Platform Name"
            placeholder="e.g. Canvas Production"
            required
          />

          <BaseFormInput
            v-model="state.issuer"
            name="issuer"
            label="Issuer (iss)"
            placeholder="https://canvas.instructure.com"
            required
            @update:model-value="onIssuerUpdate"
          />

          <BaseFormInput
            v-model="state.clientId"
            name="clientId"
            label="Client ID"
            placeholder="The Client ID from the LMS"
            required
          />

          <div class="grid grid-cols-1 gap-4">
            <BaseFormInput
              v-model="state.authEndpoint"
              name="authEndpoint"
              label="Auth Endpoint"
              required
            />
            <BaseFormInput
              v-model="state.tokenEndpoint"
              name="tokenEndpoint"
              label="Token Endpoint"
              required
            />
            <BaseFormInput
              v-model="state.jwksEndpoint"
              name="jwksEndpoint"
              label="JWKS Endpoint"
              required
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-8">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton
            type="submit"
            :label="isEdit ? 'Save Changes' : 'Create Platform'"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { z } from 'zod'

interface PlatformItem {
  id: string
  name: string | null
  issuer: string
  clientId: string
  authEndpoint: string
  tokenEndpoint: string
  jwksEndpoint: string
  [key: string]: unknown
}

const props = defineProps<{
  platform: PlatformItem | null
}>()

const emit = defineEmits<{
  saved: [id: string, updates: Partial<PlatformItem>]
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })
const loading = ref(false)
const toast = useToast()

const isEdit = computed(() => !!props.platform)
const panelDescription = computed(() =>
  isEdit.value
    ? `Editing platform ${props.platform?.name || props.platform?.issuer}`
    : 'Register a new LTI 1.3 platform'
)

const state = reactive({
  name: '',
  issuer: '',
  clientId: '',
  authEndpoint: '',
  tokenEndpoint: '',
  jwksEndpoint: ''
})

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  issuer: z.string().url('Must be a valid URL'),
  clientId: z.string().min(1, 'Client ID is required'),
  authEndpoint: z.string().url('Invalid URL'),
  tokenEndpoint: z.string().url('Invalid URL'),
  jwksEndpoint: z.string().url('Invalid URL')
})

watch([() => props.platform, open], ([item, isOpen]) => {
  if (!isOpen) return
  if (item) {
    state.name = item.name ?? ''
    state.issuer = item.issuer
    state.clientId = item.clientId
    state.authEndpoint = item.authEndpoint
    state.tokenEndpoint = item.tokenEndpoint
    state.jwksEndpoint = item.jwksEndpoint
  } else {
    Object.assign(state, {
      name: '',
      issuer: '',
      clientId: '',
      authEndpoint: '',
      tokenEndpoint: '',
      jwksEndpoint: ''
    })
  }
})

function onIssuerUpdate(val: string) {
  if (isEdit.value || !val) return
  const isCanvas = val.includes('canvas') || val.includes('instructure')
  if (isCanvas) {
    const cleanIssuer = val.replace(/\/$/, '')
    state.authEndpoint = `${cleanIssuer}/api/lti/authorize_redirect`
    state.tokenEndpoint = `${cleanIssuer}/login/oauth2/token`
    state.jwksEndpoint = `${cleanIssuer}/api/lti/security/jwks`
    if (!state.name) state.name = 'Canvas'
  }
}

async function handleSubmit() {
  loading.value = true
  try {
    if (isEdit.value && props.platform) {
      await $fetch(`/api/admin/platforms/${props.platform.id}`, {
        method: 'PATCH',
        body: state
      })
      emit('saved', props.platform.id, { ...state })
      toast.add({ title: 'Platform updated', color: 'success' })
    } else {
      await $fetch('/api/admin/platforms', {
        method: 'POST',
        body: state
      })
      emit('created')
      toast.add({ title: 'Platform registered', color: 'success' })
    }
    open.value = false
  } catch (err: any) {
    toast.add({
      title: 'Failed to save',
      description: err.data?.message || 'Check server logs',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>
