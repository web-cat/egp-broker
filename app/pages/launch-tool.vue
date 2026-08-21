<template>
  <div v-if="status === 'pending'">Redirecting to tool...</div>
  <form v-else-if="data" id="ltiForm" :action="data.url" method="POST">
    <input v-for="(val, key) in data.params" :key="key" type="hidden" :name="key" :value="val" />
    <noscript><button type="submit">Click here to continue</button></noscript>
  </form>
</template>

<script setup lang="ts">
import { useToolLaunchParams } from '~/composables/features/useToolLaunchParams'

const { data, status } = await useToolLaunchParams()

onMounted(() => {
  if (data.value) {
    const form = document.getElementById('ltiForm') as HTMLFormElement | null
    form?.submit()
  }
})
</script>
