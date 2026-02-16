<template>
  <UPage class="bg-transparent">
    <UPageBody>
      <UContainer>
        <!-- Case 1: Not Logged In -->
        <div v-if="!loggedIn" class="max-w-2xl mx-auto py-24 text-center animate-fade-up">
          <UIcon name="i-lucide-shield-alert" class="w-20 h-20 mx-auto mb-8 text-primary-500/50" />
          <h2 class="text-4xl font-bold mb-6 tracking-tight">
            {{ t('pages.dashboard.notLoggedIn.title') }}
          </h2>
          <p class="text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-10">
            {{ t('pages.dashboard.notLoggedIn.description') }}
          </p>
          <BaseButton
            :to="localePath('/auth/login')"
            color="primary"
            size="lg"
            icon="i-lucide-log-in"
          >
            {{ t('auth.login.title') }}
          </BaseButton>
        </div>

        <!-- Case 2: Logged In -->
        <template v-else>
          <!-- Initial Loading state (Wait for enrollment response) -->
          <div
            v-if="enrollmentStatus === 'pending' && !enrollment"
            class="flex flex-col items-center justify-center py-32 space-y-6"
          >
            <UIcon name="i-lucide-loader-2" class="w-12 h-12 animate-spin text-primary-500" />
            <p class="text-gray-500 font-medium">{{ t('global.status.loading') }}</p>
          </div>

          <!-- Enrollment Data Ready -->
          <div v-else-if="enrollmentStatus === 'success' && enrollment" class="animate-fade-up">
            <!-- Sub-case: Active Course Selected -->
            <div v-if="enrollment.data">
              <FeaturesDashboardTeacher
                v-if="enrollment.data.role === 'TEACHER' || enrollment.data.role === 'TA'"
                :course-title="enrollment.data.courseTitle"
                :course-code="enrollment.data.courseLabel"
                :is-admin="user?.globalRole === 'ADMIN'"
              />
              <FeaturesDashboardStudent
                v-else-if="enrollment.data.role === 'STUDENT'"
                :course-title="enrollment.data.courseTitle"
                :course-code="enrollment.data.courseLabel"
                :is-admin="user?.globalRole === 'ADMIN'"
              />
            </div>

            <!-- Sub-case: No Active Course (Show List) -->
            <div v-else>
              <div class="flex items-center justify-between mb-8">
                <h2 class="text-3xl font-bold flex items-center gap-3">
                  <UIcon name="i-lucide-graduation-cap" class="text-primary-500" />
                  {{ t('pages.dashboard.list.title') }}
                </h2>
                <BaseButton
                  v-if="coursesStatus === 'success'"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  size="sm"
                  @click="() => refreshCourses()"
                />
              </div>

              <!-- Loading courses list -->
              <div v-if="coursesStatus === 'pending'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UCard v-for="i in 2" :key="i" class="animate-pulse">
                  <div class="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
                </UCard>
              </div>

              <!-- Course Grid Feature Component -->
              <CourseGrid
                v-else-if="
                  coursesStatus === 'success' && courses && courses.data && courses.data.length > 0
                "
                :courses="courses.data"
              />

              <!-- Error courses list -->
              <BaseCard
                v-else-if="coursesStatus === 'error'"
                class="text-center py-12 border-red-200"
              >
                <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p class="text-red-500 font-medium">{{ t('global.status.loadingFailed') }}</p>
                <BaseButton
                  class="mt-4"
                  variant="ghost"
                  color="red"
                  size="sm"
                  icon="i-lucide-refresh-cw"
                  @click="() => refreshCourses()"
                >
                  {{ t('global.actions.reset') }}
                </BaseButton>
              </BaseCard>

              <!-- Empty Courses State -->
              <BaseCard v-else-if="coursesStatus === 'success'" class="text-center py-12">
                <UIcon name="i-lucide-book-open-x" class="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p class="text-gray-500 font-medium">{{ t('global.empty.noCourses') }}</p>
              </BaseCard>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="enrollmentStatus === 'error'" class="max-w-2xl mx-auto py-24 text-center">
            <UIcon name="i-lucide-alert-triangle" class="w-16 h-16 mx-auto mb-6 text-red-500" />
            <h2 class="text-3xl font-bold mb-4">{{ t('global.status.error') }}</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400">
              {{
                isUnauthorized(enrollmentError)
                  ? t('auth.login.messages.error.sessionExpired')
                  : t('global.status.loadingFailed')
              }}
            </p>
            <BaseButton
              v-if="!isUnauthorized(enrollmentError)"
              class="mt-8"
              icon="i-lucide-refresh-cw"
              @click="refreshEnrollment"
            >
              {{ t('global.actions.reset') }}
            </BaseButton>
            <BaseButton v-else class="mt-8" icon="i-lucide-log-in" to="/auth/login">
              {{ t('auth.login.submit') }}
            </BaseButton>
          </div>
        </template>
      </UContainer></UPageBody
    >
  </UPage>
</template>

<script lang="ts" setup>
import type { SimpleEnrollment } from '@@/shared/models/enrollment'
import type { ApiResponse } from '@@/shared/types/api'
import CourseGrid from '~/components/features/course/CourseGrid.vue'

// Composables
const { t } = useI18n()
const { loggedIn, user, clear } = useUserSession()
const localePath = useLocalePath()

// SEO
useSeo('home')

// Data fetching
const {
  data: enrollment,
  status: enrollmentStatus,
  error: enrollmentError,
  refresh: refreshEnrollment
} = await useFetch<ApiResponse<SimpleEnrollment>>('/api/me/enrollment', {
  immediate: loggedIn.value,
  watch: [loggedIn, user]
})

// Helper to check for unauthorized errors (handles both .status and .statusCode)
const isUnauthorized = (err: any) => {
  if (!err) return false
  const code =
    err.status ||
    err.statusCode ||
    (err.response && (err.response.status || err.response.statusCode))
  return code === 401
}

// Handle 401 Unauthorized errors by clearing the local session
watch(enrollmentError, (newError: any) => {
  if (isUnauthorized(newError)) {
    clear()
  }
})

// Fetch all available courses ONLY if no course is currently active
const {
  data: courses,
  status: coursesStatus,
  //error: coursesError,
  refresh: refreshCourses
} = await useFetch<ApiResponse<SimpleEnrollment[]>>('/api/me/enrollments', {
  immediate: loggedIn.value && !enrollment.value?.data?.role,
  watch: [loggedIn, enrollment]
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
