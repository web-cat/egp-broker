<template>
  <UInput
    :model-value="modelValue"
    v-bind="$attrs"
    :ui="{
      base: 'transition-all duration-200',
      color: {
        white: {
          outline:
            'shadow-sm bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400'
        }
      }
    }"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #leading>
      <slot name="leading" />
    </template>
    <template #trailing>
      <slot name="trailing" />
    </template>
  </UInput>
</template>

<script setup lang="ts">
/**
 * BaseInput
 * Wrapper around UInput with premium styling.
 */
defineProps<{
  modelValue?: string | number
}>()

defineEmits<(e: 'update:modelValue', value: string | number) => void>()
</script>
