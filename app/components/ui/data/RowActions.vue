<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  items: DropdownMenuItem[][]
}>()
</script>

<template>
  <div class="text-right">
    <UDropdownMenu :items="items" :content="{ align: 'end' as const }">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        color="neutral"
        variant="ghost"
        aria-label="Row actions"
      />
    </UDropdownMenu>
  </div>
</template>
