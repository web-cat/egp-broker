<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Grade Translation' : 'New Grade Translation'"
    :description="isEdit ? 'Update the grading scale mapping.' : 'Create a new grading scale mapping.'"
  >
    <template #body>
      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <BaseFormInput
          v-model="state.name"
          name="name"
          label="Translation Name"
          placeholder="e.g., Mastery-Based Scale"
          required
          autofocus
        />

        <UFormField label="Description" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Optional description of how this scale is used..."
            autoresize
          />
        </UFormField>

        <UFormField label="Grading Strategy" name="type">
          <USelectMenu
            v-model="state.type"
            :items="[
              { label: 'Categorical / Mastery (Numerical Remap)', value: 'CATEGORICAL' },
              { label: 'Pass / Fail', value: 'PASS_FAIL' }
            ]"
            value-key="value"
          />
        </UFormField>

        <!-- 1. CATEGORICAL UI WITH NUMERICAL REMAPPING -->
        <div v-if="state.type === 'CATEGORICAL'" class="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <UFormField 
            label="Target Maximum Scale Value (maxScore)" 
            description="The highest possible score on the new scale (e.g., 4.0 for a 4-point scale)."
          >
            <!-- Linked directly to state.maxScore -->
            <UInput v-model.number="state.maxScore" type="number" step="0.1" placeholder="4.0" class="w-32" />
          </UFormField>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-semibold">Threshold Mapping</label>
              <UButton size="xs" variant="soft" icon="i-lucide-plus" label="Add Threshold" @click="addRow" />
            </div>
            <p class="text-xs text-neutral-500 mb-2">
              Define the min raw score (0.0-1.0) and the corresponding value on the new scale.
            </p>

            <div v-for="(row, index) in mappingRows" :key="index" class="flex items-center gap-2">
              <UInput v-model="row.threshold" type="number" step="0.01" min="0" max="1" placeholder="Min 0.90" class="w-24" />
              <UIcon name="i-lucide-arrow-right" class="text-neutral-400" />
              <UInput v-model="row.value" type="number" step="0.1" placeholder="Value" class="w-24" />
              <UInput v-model="row.label" placeholder="Mastery" class="flex-1" />
              <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" @click="removeRow(index)" />
            </div>
          </div>
        </div>

        <!-- 2. PASS/FAIL UI -->
        <div v-else-if="state.type === 'PASS_FAIL'" class="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <!-- Added maxScore configuration for Pass/Fail -->
          <UFormField 
            label="Target Maximum Scale Value (maxScore)" 
            description="The score sent to the LMS for a 'Pass' (usually 1.0 or 100)."
          >
            <UInput v-model.number="state.maxScore" type="number" step="0.1" class="w-32" />
          </UFormField>

          <UFormField label="Pass Threshold" description="Scores at or above this raw value (0.0-1.0) will be marked as 'Pass'.">
            <UInput v-model="state.passFailThreshold" type="number" step="0.01" min="0" max="1" />
          </UFormField>
        </div>

        <div class="flex justify-end gap-x-2 mt-8">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="open = false" />
          <UButton type="submit" color="primary" label="Save" :loading="pending" />
        </div>
      </UForm>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
interface GradeTranslationRow {
  id: string
  name: string
  description: string | null
  maxScore: number | null // Reflected top-level field
  mapping: any | null
}

const props = defineProps<{ translation: GradeTranslationRow | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits(['saved', 'created'])

const pending = ref(false)
const isEdit = computed(() => !!props.translation)

const state = reactive({
  name: '',
  description: '',
  type: 'CATEGORICAL',
  maxScore: 4.0, // Default to 4-point scale for research context
  passFailThreshold: 0.8
})

const mappingRows = ref<{ threshold: string; value: string; label: string }[]>([])
const addRow = () => mappingRows.value.push({ threshold: '', value: '', label: '' })
const removeRow = (index: number) => mappingRows.value.splice(index, 1)

const syncState = (data: GradeTranslationRow | null) => {
  if (data) {
    state.name = data.name
    state.description = data.description ?? ''
    state.maxScore = data.maxScore ?? 4.0 // Pull from the new column
    
    const mapping = data.mapping || {}
    state.type = mapping.type || 'CATEGORICAL'

    if (state.type === 'CATEGORICAL') {
      mappingRows.value = (mapping.levels || [])
        .map((l: any) => ({ threshold: l.threshold, value: l.value, label: l.label }))
        .sort((a, b) => Number(b.threshold) - Number(a.threshold))
    } else if (state.type === 'PASS_FAIL') {
      state.passFailThreshold = mapping.threshold
    }
  } else {
    // Defaults for new creation
    state.name = ''
    state.type = 'CATEGORICAL'
    state.maxScore = 4.0
    mappingRows.value = [
      { threshold: '0.90', value: '4.0', label: 'Mastery' },
      { threshold: '0.75', value: '3.0', label: 'Proficient' }
    ]
  }
}

watch(() => props.translation, (val) => syncState(val), { immediate: true })
watch(open, (isOpen) => { if (isOpen) syncState(props.translation) })

async function onSubmit() {
  pending.value = true
  
  // 1. Determine the maxScore to save to the database column
  // For Pass/Fail, we usually default to 1.0 (Canvas standard), 
  // but for Categorical, we use the user-defined state.maxScore.
  const savedMaxScore = state.type === 'CATEGORICAL' ? state.maxScore : 1.0
  
  let finalMapping: any = { type: state.type }
  
  if (state.type === 'CATEGORICAL') {
    finalMapping.levels = mappingRows.value
      .filter(r => r.threshold !== '')
      .map(r => ({ 
        threshold: parseFloat(r.threshold), 
        value: parseFloat(r.value), 
        label: r.label 
      }))
  } else if (state.type === 'PASS_FAIL') {
    finalMapping.threshold = state.passFailThreshold
    // Optional: add labels to the mapping for consistency in the proxy logic
    finalMapping.passValue = 1.0 
    finalMapping.failValue = 0.0
  }

  try {
    const url = isEdit.value ? `/api/admin/grade-translations/${props.translation?.id}` : '/api/admin/grade-translations'
    const method = isEdit.value ? 'PATCH' : 'POST'
    
    await $fetch<any>(url, { 
      method, 
      body: { 
        name: state.name, 
        description: state.description, 
        maxScore: savedMaxScore, // This maps to your new Prisma column
        mapping: finalMapping 
      } 
    })

    open.value = false
    emit(isEdit.value ? 'saved' : 'created')
  } catch (err) {
    console.error('Save failed:', err)
  } finally {
    pending.value = false
  }
}
</script>