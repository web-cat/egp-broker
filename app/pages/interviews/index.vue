<template>
  <UPage>
    <UPageBody>
      <UContainer>
        <div v-if="enrollmentStatus === 'pending'" class="py-16 flex justify-center">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary-500" />
        </div>

        <div v-else-if="!currentCourse" class="max-w-md mx-auto py-16 text-center space-y-4">
          <UIcon name="i-lucide-book-open-x" class="w-12 h-12 mx-auto text-neutral-400" />
          <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            No Active Course Selected
          </h2>
          <p class="text-sm text-neutral-500">
            Please select a course from your dashboard where you are a Teaching Assistant or Instructor.
          </p>
          <BaseButton to="/" icon="i-lucide-arrow-left" label="Return to Dashboard" />
        </div>

        <div v-else-if="!isAuthorized" class="max-w-md mx-auto py-16 text-center space-y-4">
          <UIcon name="i-lucide-shield-alert" class="w-12 h-12 mx-auto text-amber-500" />
          <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Access Restricted
          </h2>
          <p class="text-sm text-neutral-500">
            The Interview Console is available to Graduate Teaching Assistants and Instructors for this course.
          </p>
          <BaseButton to="/" icon="i-lucide-arrow-left" label="Return to Dashboard" />
        </div>

        <FeaturesGtaInterviewConsole
          v-else
          :course-id="currentCourse.courseId"
          :course-title="currentCourse.courseTitle"
          :course-code="currentCourse.courseLabel"
          :interview-location="currentCourse.interviewLocation"
        />
      </UContainer>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCurrentEnrollment } from '~/composables/features/useEnrollmentsFeature'
import FeaturesGtaInterviewConsole from '~/components/features/gta/GtaInterviewConsole.vue'

definePageMeta({
  middleware: ['auth']
})

const { user } = useUserSession()
const { data: enrollment, status: enrollmentStatus } = await useCurrentEnrollment({
  immediate: true
})

const currentCourse = computed(() => enrollment.value?.data || null)

const isAuthorized = computed(() => {
  if (user.value?.globalRole === 'ADMIN') return true
  const role = currentCourse.value?.role?.toUpperCase()
  return (
    role === 'TA' ||
    role === 'TEACHER' ||
    role === 'INSTRUCTOR' ||
    role === 'ADMIN' ||
    role === 'DESIGNER'
  )
})
</script>
