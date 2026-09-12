<template>
  <ProctorConsole :is-training="false" :proctor-state="proctorState" />
</template>

<script setup lang="ts">
import ProctorConsole from '~/components/features/proctor/ProctorConsole.vue'
import { useCbtfProctor } from '~/composables/features/proctor/useCbtfProctor'

definePageMeta({
  middleware: ['proctor-only']
})

const proctorState = useCbtfProctor()
</script>
