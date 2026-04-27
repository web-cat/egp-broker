<template>
  <div class="flex flex-col items-center justify-center min-h-screen p-4 text-center">
    <div class="max-w-md p-8 bg-white rounded-xl shadow-lg border border-blue-50">
      <div class="mb-6 text-blue-500">
        <Icon name="ph:clock-countdown-duotone" size="64" />
      </div>
      
      <h1 class="text-2xl font-bold text-gray-800 mb-2">
        Almost there!
      </h1>
      
      <p class="text-gray-600 mb-6">
        The assignment <strong>{{ route.query.title || 'this task' }}</strong> 
        hasn't been finalized by your instructor yet. 
      </p>

      <div class="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-6">
        Your progress isn't lost—you just can't start quite yet. 
        Please check back in a few minutes or contact your teacher.
      </div>

      <UButton 
        to="/dashboard" 
        color="blue" 
        variant="soft" 
        icon="i-heroicons-arrow-left"
      >
        Go back to Dashboard
      </UButton>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
</script>