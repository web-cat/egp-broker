<template>
  <UPage>
    <UPageBody>
      <UContainer>
        <FeaturesGtaInterviewConsole
          course-id="training-sandbox"
          course-title="Software Design & Data Structures (Training Sandbox)"
          course-code="CS 2114"
          interview-location="McBryde Hall 106"
          :is-training="true"
          :training-state="trainingState"
        />
      </UContainer>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import { useGtaInterviewTraining } from '~/composables/features/useGtaInterviewTraining'
import FeaturesGtaInterviewConsole from '~/components/features/gta/GtaInterviewConsole.vue'

definePageMeta({
  middleware: ['auth']
})

const trainingState = useGtaInterviewTraining()
</script>
