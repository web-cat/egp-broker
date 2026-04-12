<script setup lang="ts">
const route = useRoute()
const assignmentId = route.params.id

// 1. Data Fetching
const availableTools = ref([])
const loadingTools = ref(true)

const fetchTools = async () => {
  try {
    // Direct fetch to bypass i18n router interference
    availableTools.value = await $fetch('/api/lti13/tools')
  } catch (e) {
    console.error('Failed to load LTI tools:', e)
  } finally {
    loadingTools.value = false
  }
}

onMounted(() => {
  fetchTools()
})

// 2. Form State
const selectedToolId = ref('')
const saving = ref(false)

async function saveConfiguration() {
  if (!selectedToolId.value) return
  
  saving.value = true
  try {
    await $fetch(`/api/assignments/${assignmentId}/configure`, {
      method: 'POST',
      body: { toolId: selectedToolId.value }
    })
    
    // Success: Redirect to the actual LTI launch endpoint
    window.location.href = `/launch/${assignmentId}`
  } catch (e) {
    // If you have UToast, you can use it here
    alert('Error: Could not save assignment configuration.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 max-w-lg">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-settings-2" class="w-5 h-5 text-primary" />
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white">
            Assignment Setup
          </h1>
        </div>
        <p class="text-xs text-neutral-500 mt-1">
          Internal ID: {{ assignmentId }}
        </p>
      </template>

      <div class="space-y-6">
        <UFormField 
          label="Select LTI Tool" 
          description="Choose which external tool should be launched for this assignment."
        >
          <USelectMenu
            v-model="selectedToolId"
            :items="availableTools"
            value-key="id"
            label-key="name"
            placeholder="Search for a tool..."
            class="w-full"
            size="lg"
            :loading="loadingTools"
          />
        </UFormField>

        <div class="pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <UButton 
            block 
            size="lg"
            color="primary"
            :loading="saving"
            :disabled="!selectedToolId || loadingTools"
            @click="saveConfiguration"
          >
            Save and Launch Tool
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>