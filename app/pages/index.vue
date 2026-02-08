<template>
  <UPage class="bg-primary-50/30 dark:bg-primary-950/30 min-h-screen">
    <!-- Header section -->
    <UPageHeader
      :title="displayTitle"
      :description="t('pages.hero.subtitle')"
      :headline="displayHeadline"
    />

    <UPageBody>
      <!-- Loading state -->
      <div
        v-if="status === 'pending'"
        class="flex flex-col items-center justify-center py-24 space-y-4"
      >
        <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
        <p class="text-neutral-500 font-medium">{{ t('global.status.loading') }}</p>
      </div>

      <!-- Dashboard dynamic rendering -->
      <template v-else-if="enrollment && enrollment.data">
        <DashboardTeacher
          v-if="enrollment.data.role === 'TEACHER' || enrollment.data.role === 'TA'"
          :course-title="enrollment.data.courseTitle"
          :is-admin="enrollment.data.globalRole === 'ADMIN'"
        />
        <DashboardStudent
          v-else-if="enrollment.data.role === 'STUDENT'"
          :course-title="enrollment.data.courseTitle"
          :is-admin="enrollment.data.globalRole === 'ADMIN'"
        />
        <!-- Fallback for users with No active course context -->
        <div v-else class="max-w-4xl mx-auto py-12">
          <div v-if="enrollment.data.globalRole === 'ADMIN'" class="mb-12">
            <UCard class="bg-secondary-50/50 dark:bg-secondary-950/50 border-secondary-200">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xl font-bold">{{ t('pages.admin.title') }}</h3>
                  <p class="text-neutral-600">{{ t('pages.admin.subtitle') }}</p>
                </div>
                <UButton
                  to="/admin"
                  icon="i-lucide-settings"
                  color="secondary"
                  :label="t('pages.admin.link')"
                />
              </div>
            </UCard>
          </div>

          <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
            <UIcon name="i-lucide-graduation-cap" class="text-primary-500" />
            {{ t('pages.dashboard.list.title') }}
          </h2>

          <!-- Course Grid -->
          <div
            v-if="courses && courses.data && courses.data.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <UCard
              v-for="course in courses.data"
              :key="course.id"
              class="hover:border-primary-500 transition-colors cursor-pointer group"
              @click="selectCourse(course.courseId)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-bold text-lg group-hover:text-primary-600">
                    {{ course.courseTitle || course.courseLabel }}
                  </h3>
                  <p class="text-sm text-neutral-500 mt-1">
                    {{ t('pages.dashboard.list.enrolledAs', { role: course.role }) }}
                  </p>
                </div>
                <UButton
                  variant="ghost"
                  color="primary"
                  icon="i-lucide-chevron-right"
                  :loading="selecting === course.courseId"
                />
              </div>
            </UCard>
          </div>

          <!-- Empty Courses State -->
          <UCard v-else class="text-center py-12">
            <UIcon name="i-lucide-book-open-x" class="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p class="text-neutral-500 font-medium">{{ t('pages.dashboard.list.empty') }}</p>
          </UCard>
        </div>
      </template>

      <!-- Error/Not Logged In state -->
      <div v-else class="max-w-2xl mx-auto py-24 text-center">
        <UIcon name="i-lucide-shield-alert" class="w-16 h-16 mx-auto mb-6 text-primary-500/50" />
        <h2 class="text-3xl font-bold mb-4">{{ t('pages.dashboard.notLoggedIn.title') }}</h2>
        <p class="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {{ t('pages.dashboard.notLoggedIn.description') }}
        </p>
      </div>
    </UPageBody>
  </UPage>
</template>

<script lang="ts" setup>
import type { EnrollmentInfo } from '@@/server/api/me/enrollment.get'
import type { SimpleEnrollment } from '@@/server/api/me/enrollments.get'
import type { ApiResponse } from '@@/shared/types/api'

// Composables
const { t } = useI18n()
const { loggedIn } = useUserSession()

// SEO
useSeo('home')

// Data fetching
const {
  data: enrollment,
  status,
  refresh: refreshEnrollment
} = await useAsyncData<ApiResponse<EnrollmentInfo>>(
  'enrollment',
  () => $fetch('/api/me/enrollment'),
  {
    immediate: loggedIn.value,
    watch: [loggedIn]
  }
)

// Fetch all available courses ONLY if no course is currently active
const { data: courses } = await useAsyncData<ApiResponse<SimpleEnrollment[]>>(
  'courses',
  () => $fetch('/api/me/enrollments'),
  {
    immediate: computed(() => loggedIn.value && !enrollment.value?.data?.role),
    watch: [loggedIn, enrollment]
  }
)

// Course selection
const selecting = ref<string | null>(null)
const selectCourse = async (courseId: string) => {
  selecting.value = courseId
  try {
    await $fetch('/api/me/context', {
      method: 'POST',
      body: { courseId }
    })
    // Refresh the enrollment data to show the dashboard
    await refreshEnrollment()
  } catch (e) {
    console.error('Failed to select course', e)
  } finally {
    selecting.value = null
  }
}

// Header Title and Headline
const displayHeadline = computed(() => t('pages.hero.title'))
const displayTitle = computed(() => {
  if (!loggedIn.value) {
    return t('pages.dashboard.notLoggedIn.header')
  }
  if (enrollment.value?.data?.courseTitle) {
    return enrollment.value.data.courseTitle
  }
  return t('pages.dashboard.list.title')
})

useHead({
  title: computed(() => {
    const base = t('pages.hero.title')
    if (!loggedIn.value) {
      return `${base} | ${t('pages.dashboard.notLoggedIn.header')}`
    }
    if (enrollment.value?.data?.courseTitle) {
      return `${base} | ${enrollment.value.data.courseTitle}`
    }
    return base
  })
})
</script>
