<template>
  <div v-if="pending">Redirecting to tool...</div>
  <form v-else id="ltiForm" :action="data.url" method="POST">
    <input v-for="(val, key) in data.params" :key="key" type="hidden" :name="key" :value="val" />
    <noscript><button type="submit">Click here to continue</button></noscript>
  </form>
</template>

<script setup>
// Get the current user/session info
const { data } = await useFetch('/api/lti13/get-tool-launch-params')

onMounted(() => {
  if (data.value) {
    document.getElementById('ltiForm').submit()
  }
})
</script>
