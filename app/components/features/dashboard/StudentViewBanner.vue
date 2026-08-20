<template>
  <div
    class="sticky top-0 z-40 mb-6 bg-amber-500 dark:bg-amber-600 text-white px-4 py-3 shadow-md rounded-xl flex items-center justify-between gap-4 animate-fade-in"
  >
    <div class="flex items-center gap-3">
      <div class="p-2 bg-amber-600/60 dark:bg-amber-700/60 rounded-lg shrink-0">
        <UIcon name="i-lucide-eye" class="w-5 h-5 text-white" />
      </div>
      <div>
        <p class="font-semibold text-sm sm:text-base leading-tight">Student View Mode</p>
        <p class="text-xs sm:text-sm text-amber-100 dark:text-amber-200">
          You are previewing this course as a student would see it.
        </p>
      </div>
    </div>

    <UButton
      label="Exit Student View"
      icon="i-lucide-log-out"
      color="neutral"
      variant="solid"
      size="sm"
      class="shrink-0 bg-white text-amber-900 hover:bg-amber-50 font-medium cursor-pointer shadow-sm"
      @click="$emit('exit')"
    />
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'exit'): void
}>()
</script>
