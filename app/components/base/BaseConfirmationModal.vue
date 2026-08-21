<template>
  <UModal v-model:open="isOpen" :title="title" :description="description">
    <template #body>
      <slot>
        <p v-if="message" class="text-sm text-neutral-600 dark:text-neutral-300">
          {{ message }}
        </p>
      </slot>
    </template>

    <template #footer>
      <slot name="footer">
        <div class="flex justify-end gap-3 w-full">
          <UButton
            :label="cancelLabel"
            color="neutral"
            variant="ghost"
            :disabled="loading"
            @click="handleCancel"
          />
          <UButton
            :label="confirmLabel"
            :color="confirmColor"
            :icon="confirmIcon"
            :loading="loading"
            @click="handleConfirm"
          />
        </div>
      </slot>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/**
 * BaseConfirmationModal
 * Pure presenter modal for confirming destructive or critical actions.
 */
import { computed } from 'vue'
import type { ButtonProps } from '@nuxt/ui'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    message?: string
    confirmLabel?: string
    confirmColor?: ButtonProps['color']
    confirmIcon?: string
    cancelLabel?: string
    loading?: boolean
  }>(),
  {
    open: false,
    title: 'Confirm Action',
    description: undefined,
    message: undefined,
    confirmLabel: 'Confirm',
    confirmColor: 'error',
    confirmIcon: 'i-lucide-trash-2',
    cancelLabel: 'Cancel',
    loading: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm' | 'cancel'): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}
</script>
