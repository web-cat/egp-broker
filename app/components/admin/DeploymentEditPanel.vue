<template>
  <USlideover v-model:open="open" :title="isEdit ? 'Edit Deployment' : 'Add Deployment'" :description="panelDescription">
    <template #body>
      <UForm ref="formRef" :state="state" @submit="handleSubmit">
        <div class="space-y-6">
          <UiFormInput
            v-if="!isEdit"
            v-model="state.platformId"
            name="platformId"
            label="Platform ID"
            placeholder="Select a platform"
            required
          />
          <UiFormInput
            v-model="state.deploymentId"
            name="deploymentId"
            label="Deployment ID"
            placeholder="e.g. 12345:abc"
            required
          />
          <UiFormInput
            v-model="state.deploymentHost"
            name="deploymentHost"
            label="Deployment Host"
            placeholder="e.g. canvas.university.edu"
          />
        </div>

        <div class="flex justify-end gap-3 mt-8">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton type="submit" :label="isEdit ? 'Save Changes' : 'Create Deployment'" />
        </div>
      </UForm>
    </template>
  </USlideover>
</template>

<script setup lang="ts">

interface DeploymentItem {
  id: string
  deploymentId: string
  deploymentHost: string | null
  platformId: string
  [key: string]: unknown
}

const props = defineProps<{
  deployment: DeploymentItem | null
  platformId?: string | null
}>()

const emit = defineEmits<{
  saved: [id: string, updates: Partial<DeploymentItem>]
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.deployment)
const panelDescription = computed(() =>
  isEdit.value ? `Editing deployment ${props.deployment?.deploymentId}` : 'Create a new deployment registration'
)

const state = reactive({
  platformId: '',
  deploymentId: '',
  deploymentHost: ''
})

watch([() => props.deployment, open], ([item, isOpen]) => {
  if (!isOpen) return
  if (item) {
    state.platformId = item.platformId
    state.deploymentId = item.deploymentId
    state.deploymentHost = item.deploymentHost ?? ''
  } else {
    state.platformId = props.platformId ?? ''
    state.deploymentId = ''
    state.deploymentHost = ''
  }
})

async function handleSubmit() {
  try {
    if (isEdit.value && props.deployment) {
      const updates = {
        deploymentId: state.deploymentId,
        deploymentHost: state.deploymentHost || null
      }
      await $fetch(`/api/admin/deployments/${props.deployment.id}`, {
        method: 'PATCH',
        body: updates
      })
      emit('saved', props.deployment.id, updates)
    } else {
      await $fetch('/api/admin/deployments', {
        method: 'POST',
        body: {
          platformId: state.platformId,
          deploymentId: state.deploymentId,
          deploymentHost: state.deploymentHost || null
        }
      })
      emit('created')
    }
    open.value = false
  } catch (err: unknown) {
    console.error('Failed to save deployment:', err)
  }
}
</script>
