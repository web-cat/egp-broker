<template>
  <ProctorConsole :is-training="true" :proctor-state="trainingState" />
</template>

<script setup lang="ts">
import ProctorConsole from '~/components/features/proctor/ProctorConsole.vue'
import { useCbtfProctorTraining } from '~/composables/features/proctor/useCbtfProctorTraining'

definePageMeta({
  middleware: ['proctor-only']
})

const trainingState = useCbtfProctorTraining()
</script>
