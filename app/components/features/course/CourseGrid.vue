<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <BaseCard
      v-for="course in courses"
      :key="course.id"
      class="group hover:border-primary-500 transition-colors"
      :interactive="true"
      @click="handleSelect(course.courseId)"
    >
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-lg group-hover:text-primary-600 transition-colors">
            {{ course.courseTitle || course.courseLabel || t('global.untitled') }}
          </h3>
          <p class="text-sm text-neutral-500 mt-1">
            {{ t('pages.dashboard.list.enrolledAs', { role: course.role }) }}
          </p>
        </div>
        <BaseButton
          variant="ghost"
          color="primary"
          icon="i-lucide-chevron-right"
          :loading="selecting === course.courseId"
        />
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { useCourseContext } from '~/composables/features/useCourseContext'

defineProps<{
  courses: Array<{
    id: string
    courseId: string
    courseTitle?: string | null
    courseLabel: string | null
    role: string
  }>
}>()

const { t } = useI18n()
const { selecting, setCourseContext } = useCourseContext()

const handleSelect = async (courseId: string) => {
  await setCourseContext(courseId)
}
</script>
