<template>
  <UButton
    v-bind="$attrs"
    :class="[
      'font-medium transition-all duration-200',
      'hover:-translate-y-0.5 active:translate-y-0',
      'disabled:hover:translate-y-0 disabled:opacity-50'
    ]"
  >
    <slot />
    <template #leading>
      <slot name="leading" />
    </template>
    <template #trailing>
      <slot name="trailing" />
    </template>
  </UButton>
</template>

<script setup lang="ts">
/**
 * BaseButton
 * Wrapper around UButton with added micro-interactions.
 */
</script>
