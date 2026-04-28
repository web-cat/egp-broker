<script setup lang="ts">
const route = useRoute()
const assignmentId = route.params.id

// 1. Data Fetching
const availableTools = ref([])
const availableTranslations = ref([])
const loadingData = ref(true)

const fetchTools = async () => {
  try {
    loadingData.value = true
    // Fetching both in parallel for efficiency
    const [tools, translations] = await Promise.all([
      $fetch('/api/lti13/tools'),
      $fetch('/api/proxy/grade-translations')
    ])
    availableTools.value = tools
    availableTranslations.value = translations
  } catch (e) {
    console.error('Failed to load configuration data:', e)
  } finally {
    loadingData.value = false
  }
}

onMounted(() => {
  fetchTools()
})

// 2. Form State
const selectedToolId = ref('')
const selectedTranslationId = ref('')
const saving = ref(false)

async function saveConfiguration() {
  //tool is required, translation is not
  if (!selectedToolId.value) return
  
  saving.value = true
  try {
    await $fetch(`/api/assignments/${assignmentId}/configure`, {
      method: 'POST',
      body: { 
        toolId: selectedToolId.value,
        gradeTranslationId: selectedTranslationId.value || null //send null if no translation chosen
      }
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
      <div class="space-y-6">
        <UFormField label="Select LTI Tool" required>
          <USelectMenu
            v-model="selectedToolId"
            :items="availableTools"
            value-key="id"
            label-key="name"
            placeholder="Select required tool..."
            class="w-full"
            size="lg"
            :loading="loadingData"
          />
        </UFormField>

        <UFormField 
          label="Grade Translation (Optional)" 
          description="If left blank, raw scores from the tool will be used."
        >
          <USelectMenu
            v-model="selectedTranslationId"
            :items="availableTranslations"
            value-key="id"
            label-key="name"
            placeholder="No translation (Pass-through)"
            class="w-full"
            size="lg"
            :loading="loadingData"
            clearable
          >
            <template #leading>
              <UIcon name="i-lucide-calculator" class="w-4 h-4 text-neutral-400" />
            </template>
          </USelectMenu>
        </UFormField>

        <div class="pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <UButton 
            block 
            size="lg"
            color="primary"
            :loading="saving"
            :disabled="!selectedToolId || loadingData"
            @click="saveConfiguration"
          >
            Save and Launch Tool
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>