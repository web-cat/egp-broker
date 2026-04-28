<template>
  <USlideover
    v-model:open="open"
    :title="isEdit ? 'Edit Grade Translation' : 'New Grade Translation'"
    :description="
      isEdit ? 'Update the grading scale mapping.' : 'Create a new grading scale mapping.'
    "
  >
    <template #body>
      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <BaseFormInput
          v-model="state.name"
          name="name"
          label="Translation Name"
          placeholder="e.g., Standard Letter Grades"
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

        <div class="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div class="flex items-center justify-between">
            <label class="text-sm font-semibold">Score Mapping</label>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-plus"
              label="Add Threshold"
              @click="addRow"
            />
          </div>
          <p class="text-xs text-neutral-500 mb-2">
            Define the minimum score (0.0 to 1.0) required for each grade label.
          </p>

          <div v-for="(row, index) in mappingRows" :key="index" class="flex items-center gap-2">
            <UInput
              v-model="row.threshold"
              type="number"
              step="0.01"
              min="0"
              max="1"
              placeholder="0.90"
              class="w-28"
            />
            <UIcon name="i-lucide-arrow-right" class="text-neutral-400" />
            <UInput v-model="row.label" placeholder="A" class="flex-1" />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              @click="removeRow(index)"
            />
          </div>

          <p
            v-if="mappingRows.length === 0"
            class="text-sm text-center py-4 text-neutral-400 italic"
          >
            No thresholds defined. Grades will pass through as raw scores.
          </p>
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
// Note: You may want to define a specific type for GradeTranslationRow in your shared models
interface GradeTranslationRow {
  id: string
  name: string
  description: string | null
  mapping: Record<string, string> | null
  createdAt: string
}

const props = defineProps<{
  translation: GradeTranslationRow | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'saved', id: string, updates: any): void
  (e: 'created'): void
  (e: 'update:open', value: boolean): void
}>()

const pending = ref(false)
const isEdit = computed(() => !!props.translation)

// Local state for basic fields
const state = reactive({
  name: '',
  description: ''
})

// Local state for the dynamic JSON mapping rows
const mappingRows = ref<{ threshold: string; label: string }[]>([])

const addRow = () => mappingRows.value.push({ threshold: '', label: '' })
const removeRow = (index: number) => mappingRows.value.splice(index, 1)

// Logic to sync internal state with the provided translation prop
const syncState = (data: GradeTranslationRow | null) => {
  if (data) {
    state.name = data.name
    state.description = data.description ?? ''
    // Convert DB JSON { "0.9": "A" } to UI rows [{ threshold: "0.9", label: "A" }]
    mappingRows.value = Object.entries(data.mapping || {})
      .map(([threshold, label]) => ({ threshold, label }))
      .sort((a, b) => Number(b.threshold) - Number(a.threshold))
  } else {
    state.name = ''
    state.description = ''
    mappingRows.value = [
      { threshold: '0.90', label: 'A' },
      { threshold: '0.80', label: 'B' },
      { threshold: '0.70', label: 'C' }
    ]
  }
}

watch(
  () => props.translation,
  (val) => syncState(val),
  { immediate: true }
)
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) syncState(props.translation)
  }
)

async function onSubmit() {
  pending.value = true

  // Convert rows back to JSON object for Prisma: { "0.9": "A" }
  const finalMapping = mappingRows.value.reduce(
    (acc, curr) => {
      if (curr.threshold !== '') {
        acc[curr.threshold] = curr.label
      }
      return acc
    },
    {} as Record<string, string>
  )

  try {
    const payload = {
      name: state.name,
      description: state.description,
      mapping: finalMapping
    }

    const url = isEdit.value
      ? `/api/admin/grade-translations/${props.translation?.id}`
      : '/api/admin/grade-translations'

    const method = isEdit.value ? 'PATCH' : 'POST'

    const res = await $fetch<any>(url, { method, body: payload })

    open.value = false
    await nextTick()

    if (isEdit.value && props.translation) {
      emit('saved', props.translation.id, res)
      useToast().add({ title: 'Translation updated' })
    } else {
      emit('created')
      useToast().add({ title: 'Translation created' })
    }
  } catch (err: any) {
    console.error(err)
    useToast().add({ title: 'Error saving translation', color: 'error' })
  } finally {
    pending.value = false
  }
}
</script>
