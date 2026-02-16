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

        <UFormField name="supportsExtensionApi">
          <UCheckbox v-model="state.supportsExtensionApi" label="Supports Extension API" />
        </UFormField>

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

const isEdit = computed(() => !!props.tool)

// Strict state for form inputs to avoid null type errors
interface LocalToolState {
  name: string
  baseUrl: string
  protocol: 'LTI11' | 'LTI13' | 'SPLICE'
  key: string
  secret: string
  supportsExtensionApi: boolean
  platformId: string | undefined
}

// Initial state
const state = reactive<LocalToolState>({
  name: '',
  baseUrl: '',
  protocol: 'LTI13',
  key: '',
  secret: '',
  supportsExtensionApi: false,
  platformId: undefined
})

// Fetch platforms for select
const { fetchPlatforms } = useAdminPlatforms()
const { saveTool } = useAdminTools()
const { data: platforms } = await fetchPlatforms()

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

// Sync state with props
watch(
  () => props.tool,
  (tool) => {
    if (tool) {
      state.name = tool.name ?? ''
      state.baseUrl = tool.baseUrl
      state.protocol = tool.protocol
      state.key = tool.key ?? ''
      state.secret = (tool as any).secret ?? ''
      state.supportsExtensionApi = tool.supportsExtensionApi
      state.platformId = tool.platformId ?? undefined
    } else {
      // Reset to initial
      state.name = ''
      state.baseUrl = ''
      state.protocol = 'LTI13'
      state.key = ''
      state.secret = ''
      state.supportsExtensionApi = false
      state.platformId = props.platformId ?? undefined
    }
  },
  { immediate: true }
)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.tool) {
        state.name = props.tool.name ?? ''
        state.baseUrl = props.tool.baseUrl
        state.protocol = props.tool.protocol
        state.key = props.tool.key ?? ''
        state.secret = (props.tool as any).secret ?? ''
        state.supportsExtensionApi = props.tool.supportsExtensionApi
        state.platformId = props.tool.platformId ?? undefined
      } else {
        state.name = ''
        state.baseUrl = ''
        state.protocol = 'LTI13'
        state.key = ''
        state.secret = ''
        state.supportsExtensionApi = false
        state.platformId = props.platformId ?? undefined
      }
    }
  }
)

async function onSubmit() {
  pending.value = true
  try {
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
