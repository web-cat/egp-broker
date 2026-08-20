<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :description="modalDescription">
    <template #body>
      <div class="space-y-6">
        <!-- Instructions Card -->
        <div
          class="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3 text-sm"
        >
          <div class="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
            <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-500" />
            <span>How to get your {{ platformName || 'Canvas' }} Access Token:</span>
          </div>
          <ol
            class="list-decimal list-inside space-y-1.5 text-neutral-600 dark:text-neutral-300 ml-1 text-xs sm:text-sm"
          >
            <li>
              In <strong>{{ platformName || 'Canvas' }}</strong
              >, click <strong>Account</strong> in the left sidebar, then select
              <strong>Settings</strong>.
            </li>
            <li>
              Scroll down to <strong>Approved Integrations</strong> and click
              <strong>+ New Access Token</strong>.
            </li>
            <li>
              Enter a purpose (e.g., <em>EGP Broker Sync</em>) and click
              <strong>Generate Token</strong>.
            </li>
            <li>Copy the generated token string and paste it into the field below.</li>
          </ol>
        </div>

        <!-- Token Input Form -->
        <form @submit.prevent="handleSubmit">
          <UFormField
            label="API Access Token"
            name="apiKey"
            required
            :error="error"
            help="Your token is stored securely and used exclusively to synchronize assignment dates."
          >
            <div class="relative w-full">
              <UInput
                v-model="apiKey"
                :type="showKey ? 'text' : 'password'"
                placeholder="Paste token here (e.g., 7~...)"
                class="w-full font-mono text-sm"
                size="lg"
                autocomplete="off"
                :disabled="loading"
                @input="error = ''"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer focus:outline-none"
                tabindex="-1"
                @click="showKey = !showKey"
              >
                <UIcon :name="showKey ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="w-4 h-4" />
              </button>
            </div>
          </UFormField>
        </form>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          @click="handleCancel"
        />
        <UButton
          label="Save & Enable Sync"
          color="primary"
          icon="i-lucide-check"
          :loading="loading"
          :disabled="!apiKey.trim()"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    platformName?: string | null
    loading?: boolean
  }>(),
  {
    open: false,
    platformName: 'Canvas',
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', apiKey: string): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const apiKey = ref('')
const showKey = ref(false)
const error = ref('')

const modalTitle = computed(() => `Enable ${props.platformName || 'Canvas'} Assignment Sync`)
const modalDescription = computed(
  () =>
    `Enter your ${props.platformName || 'Canvas'} API Access Token to automatically import and sync assignments.`
)

// Reset form when modal closes or opens
watch(
  () => props.open,
  (val) => {
    if (val) {
      apiKey.value = ''
      showKey.value = false
      error.value = ''
    }
  }
)

function handleSubmit() {
  const trimmed = apiKey.value.trim()
  if (!trimmed) {
    error.value = 'Please enter a valid API access token.'
    return
  }
  error.value = ''
  emit('save', trimmed)
}

function handleCancel() {
  emit('update:open', false)
}
</script>
