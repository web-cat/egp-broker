<template>
  <UCard
    v-bind="$attrs"
    :class="[
      'transition-all duration-300',
      'hover:shadow-lg hover:border-primary-500/30',
      interactive ? 'cursor-pointer hover:-translate-y-1' : ''
    ]"
    :ui="{
      base: 'overflow-hidden',
      background: 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
      ring: 'ring-1 ring-gray-200 dark:ring-gray-800',
      divide: 'divide-y divide-gray-200 dark:divide-gray-800',
      header: { padding: 'px-4 py-5 sm:px-6' },
      body: { padding: 'px-4 py-5 sm:p-6' },
      footer: { padding: 'px-4 py-4 sm:px-6' }
    }"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UCard>
</template>

<script setup lang="ts">
/**
 * BaseCard
 * Wrapper around UCard with glassmorphism and hover effects.
 */
defineProps({
  interactive: {
    type: Boolean,
    default: false
  }
})
</script>
