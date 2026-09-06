<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Tool' : 'New Tool'"
    :description="isEdit ? 'Update LTI tool configuration.' : 'Register a new LTI tool.'"
  >
    <template #body>
      <UForm
        :schema="isEdit ? updateToolSchema : createToolSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
        @error="onError"
      >
        <BaseFormInput
          v-model="state.name"
          name="name"
          label="Tool Name"
          placeholder="Gradescope"
          required
          autofocus
        />

        <BaseFormInput
          v-model="state.baseUrl"
          name="baseUrl"
          label="Base URL"
          placeholder="https://www.gradescope.com"
          required
        />

        <UFormField label="Protocol" name="protocol" required>
          <USelect
            v-model="state.protocol"
            :items="protocolOptions"
            placeholder="Select protocol"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Platform" name="platformId">
          <USelect
            v-model="state.platformId"
            :items="platformOptions"
            placeholder="Select platform (optional)"
            class="w-full"
          />
        </UFormField>

        <!-- Role Configuration -->
        <div class="space-y-2 pt-2 border-t border-border">
          <h4 class="text-sm font-medium text-foreground">Tool Roles & Capabilities</h4>
          <div class="space-y-2">
            <UFormField name="supportsProxy">
              <UCheckbox
                v-model="state.supportsProxy"
                label="Supports LTI Proxy"
                help="Proxies LTI launches from LMS platforms through the broker"
              />
            </UFormField>
            <UFormField name="supportsPassport">
              <UCheckbox
                v-model="state.supportsPassport"
                label="Supports PassPort Extensions"
                help="Enables dynamic registration and extension syncing via PassPort API"
              />
            </UFormField>
          </div>
        </div>

        <!-- LTI Proxy Credentials (shown when supportsProxy is enabled) -->
        <div v-if="state.supportsProxy" class="space-y-4 pt-2 border-t border-border">
          <h4 class="text-sm font-medium text-foreground">LTI Proxy Credentials</h4>
          <BaseFormInput
            v-model="state.key"
            name="key"
            label="Consumer Key"
            placeholder="Consumer key (LTI 1.1)"
          />

          <BaseFormInput
            v-model="state.secret"
            name="secret"
            label="Shared Secret"
            type="password"
            placeholder="Shared secret (LTI 1.1)"
          />
        </div>

        <!-- PassPort Configuration (shown when supportsPassport is enabled) -->
        <div v-if="state.supportsPassport" class="space-y-4 pt-2 border-t border-border">
          <h4 class="text-sm font-medium text-foreground">PassPort Configuration</h4>
          <BaseFormInput
            v-model="state.passportRegistrationUrl"
            name="passportRegistrationUrl"
            label="Registration URL"
            placeholder="https://external-tool.edu/api/passport/v1/register"
            help="Target endpoint where dynamic registration request is dispatched"
          />

          <!-- Registration Status & Action Station -->
          <div v-if="isEdit" class="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs text-muted-foreground uppercase font-semibold">
                  Registration Status
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <UBadge :color="statusBadgeColor" variant="subtle" :icon="statusBadgeIcon">
                    {{ statusBadgeLabel }}
                  </UBadge>
                  <span v-if="state.passportRegisteredAt" class="text-xs text-muted-foreground">
                    {{ formatDate(state.passportRegisteredAt) }}
                  </span>
                </div>
              </div>

              <UButton
                v-if="state.passportRegistrationUrl"
                size="xs"
                color="primary"
                variant="outline"
                icon="i-lucide-send"
                label="Register with PassPort"
                :loading="registering"
                @click="onRegisterPassPort"
              />
            </div>

            <!-- Error Banner -->
            <UAlert
              v-if="
                state.passportRegistrationStatus === 'FAILED' && state.passportRegistrationError
              "
              color="error"
              variant="subtle"
              icon="i-lucide-alert-circle"
              title="Registration Failed"
              :description="state.passportRegistrationError"
            />
          </div>
          <div v-else class="text-xs text-muted-foreground italic">
            Save this tool first to trigger dynamic PassPort registration.
          </div>

          <!-- Advanced PassPort Details -->
          <div class="space-y-3 pt-2">
            <div class="text-xs font-medium text-muted-foreground">
              Credentials & Handler (Received via Registration)
            </div>
            <BaseFormInput
              v-model="state.passportExtensionUrl"
              name="passportExtensionUrl"
              label="Extension Handler URL"
              placeholder="https://external-tool.edu/api/passport/v1/extensions"
            />
            <BaseFormInput
              v-model="state.passportClientId"
              name="passportClientId"
              label="PassPort Client ID"
              placeholder="client_id_from_tool"
            />
            <BaseFormInput
              v-model="state.passportClientSecret"
              name="passportClientSecret"
              label="PassPort Client Secret"
              type="password"
              placeholder="client_secret_from_tool"
            />
          </div>
        </div>

        <div class="flex justify-end gap-x-2 mt-6">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="open = false" />
          <UButton type="submit" color="primary" label="Save" :loading="pending" />
        </div>
      </UForm>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { type ToolRow, createToolSchema, updateToolSchema } from '@@/shared/models/tool'
import type { PassPortRegistrationStatus } from '@@/shared/models/passport'
import { formatDate } from '~/utils/date'

const props = defineProps<{
  tool: ToolRow | null
  platformId?: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'saved', id: string, updates: Partial<ToolRow>): void
  (e: 'created'): void
  (e: 'update:open', value: boolean): void
}>()

const { t: _t } = useI18n()
const pending = ref(false)
const registering = ref(false)

const isEdit = computed(() => !!props.tool)

// Strict state for form inputs to avoid null type errors
interface LocalToolState {
  name: string
  baseUrl: string
  protocol: 'LTI11' | 'LTI13' | 'SPLICE'
  key: string
  secret: string
  supportsProxy: boolean
  supportsPassport: boolean
  supportsExtensionApi: boolean
  platformId: string | undefined
  passportClientId: string
  passportClientSecret: string
  passportRegistrationUrl: string
  passportExtensionUrl: string
  passportRegistrationStatus: PassPortRegistrationStatus
  passportRegistrationError: string | null
  passportRegisteredAt: string | null
}

// Initial state
const state = reactive<LocalToolState>({
  name: '',
  baseUrl: '',
  protocol: 'LTI13',
  key: '',
  secret: '',
  supportsProxy: true,
  supportsPassport: false,
  supportsExtensionApi: false,
  platformId: undefined,
  passportClientId: '',
  passportClientSecret: '',
  passportRegistrationUrl: '',
  passportExtensionUrl: '',
  passportRegistrationStatus: 'NOT_REGISTERED',
  passportRegistrationError: null,
  passportRegisteredAt: null
})

// Fetch platforms for select
const { fetchPlatforms } = useAdminPlatforms()
const { saveTool, registerPassPort } = useAdminTools()
const { data: platforms } = fetchPlatforms()

const platformOptions = computed(() => {
  return (
    platforms.value?.data?.map((p) => ({
      label: p.issuer,
      value: p.id
    })) ?? []
  )
})

const protocolOptions = [
  { label: 'LTI 1.1', value: 'LTI11' },
  { label: 'LTI 1.3', value: 'LTI13' },
  { label: 'SPLICE', value: 'SPLICE' }
]

const statusBadgeColor = computed(() => {
  switch (state.passportRegistrationStatus) {
    case 'REGISTERED':
      return 'success'
    case 'PENDING':
      return 'info'
    case 'FAILED':
      return 'error'
    case 'NOT_REGISTERED':
    default:
      return 'neutral'
  }
})

const statusBadgeIcon = computed(() => {
  switch (state.passportRegistrationStatus) {
    case 'REGISTERED':
      return 'i-lucide-check-circle'
    case 'PENDING':
      return 'i-lucide-clock'
    case 'FAILED':
      return 'i-lucide-alert-circle'
    case 'NOT_REGISTERED':
    default:
      return 'i-lucide-circle-dashed'
  }
})

const statusBadgeLabel = computed(() => {
  switch (state.passportRegistrationStatus) {
    case 'REGISTERED':
      return 'Registered'
    case 'PENDING':
      return 'Pending'
    case 'FAILED':
      return 'Failed'
    case 'NOT_REGISTERED':
    default:
      return 'Not Registered'
  }
})

function syncState(tool: ToolRow | null) {
  if (tool) {
    state.name = tool.name ?? ''
    state.baseUrl = tool.baseUrl
    state.protocol = tool.protocol
    state.key = tool.key ?? ''
    state.secret = (tool as any).secret ?? ''
    state.supportsProxy = tool.supportsProxy ?? true
    state.supportsPassport = tool.supportsPassport ?? false
    state.supportsExtensionApi = tool.supportsExtensionApi ?? false
    state.platformId = tool.platformId ?? undefined
    state.passportClientId = tool.passportClientId ?? ''
    state.passportClientSecret = (tool as any).passportClientSecret ?? ''
    state.passportRegistrationUrl = tool.passportRegistrationUrl ?? ''
    state.passportExtensionUrl = tool.passportExtensionUrl ?? ''
    state.passportRegistrationStatus = tool.passportRegistrationStatus ?? 'NOT_REGISTERED'
    state.passportRegistrationError = tool.passportRegistrationError ?? null
    state.passportRegisteredAt = tool.passportRegisteredAt ?? null
  } else {
    state.name = ''
    state.baseUrl = ''
    state.protocol = 'LTI13'
    state.key = ''
    state.secret = ''
    state.supportsProxy = true
    state.supportsPassport = false
    state.supportsExtensionApi = false
    state.platformId = props.platformId ?? undefined
    state.passportClientId = ''
    state.passportClientSecret = ''
    state.passportRegistrationUrl = ''
    state.passportExtensionUrl = ''
    state.passportRegistrationStatus = 'NOT_REGISTERED'
    state.passportRegistrationError = null
    state.passportRegisteredAt = null
  }
}

// Sync state with props
watch(
  () => props.tool,
  (tool) => syncState(tool),
  { immediate: true }
)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      syncState(props.tool)
    }
  }
)

async function onRegisterPassPort() {
  if (!props.tool?.id) return
  registering.value = true
  const toast = useToast()
  try {
    toast.add({ title: 'Initiating PassPort registration...', color: 'info' })
    const res = await registerPassPort(props.tool.id)
    state.passportRegistrationStatus = 'PENDING'
    state.passportRegistrationError = null
    toast.add({ title: 'PassPort registration initiated', color: 'success' })
    if (res.data) {
      emit('saved', props.tool.id, res.data)
    }
  } catch (err: any) {
    state.passportRegistrationStatus = 'FAILED'
    const errorMsg =
      err?.data?.statusMessage ||
      err?.data?.message ||
      err?.message ||
      'Failed to initiate registration'
    state.passportRegistrationError = errorMsg
    toast.add({
      title: 'PassPort registration failed',
      description: errorMsg,
      color: 'error'
    })
  } finally {
    registering.value = false
  }
}

async function onSubmit() {
  pending.value = true
  try {
    // Keep supportsExtensionApi aligned with supportsPassport
    state.supportsExtensionApi = state.supportsPassport || state.supportsExtensionApi

    const res = await saveTool(state, props.tool?.id)

    if (isEdit.value && props.tool) {
      if (res.data) {
        emit('saved', props.tool.id, res.data)
      }
      const toast = useToast()
      toast.add({ title: 'Tool updated' })
    } else {
      emit('created')
      const toast = useToast()
      toast.add({ title: 'Tool created' })
    }
    emit('update:open', false)
    open.value = false
  } catch (err: any) {
    console.error(err)
    const toast = useToast()
    toast.add({ title: 'Error saving tool', color: 'error' })
  } finally {
    pending.value = false
  }
}

function onError(event: any) {
  console.log('Form error:', event)
}
</script>
