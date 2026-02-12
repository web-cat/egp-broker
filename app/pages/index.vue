<template>
  <UPage class="bg-primary-50/30 dark:bg-primary-950/30 min-h-screen">
    <UPageBody
      ><UContainer>
        <!-- Case 1: Not Logged In -->
        <div v-if="!loggedIn" class="max-w-2xl mx-auto py-24 text-center">
          <UIcon name="i-lucide-shield-alert" class="w-16 h-16 mx-auto mb-6 text-primary-500/50" />
          <h2 class="text-3xl font-bold mb-4">{{ t('pages.dashboard.notLoggedIn.title') }}</h2>
          <p class="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {{ t('pages.dashboard.notLoggedIn.description') }}
          </p>
        </div>

        <!-- Case 2: Logged In -->
        <template v-else>
          <!-- Initial Loading state (Wait for enrollment response) -->
          <div
            v-if="enrollmentStatus === 'pending' && !enrollment"
            class="flex flex-col items-center justify-center py-24 space-y-4"
          >
            <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
            <p class="text-neutral-500 font-medium">{{ t('global.status.loading') }}</p>
          </div>

          <!-- Enrollment Data Ready -->
          <div v-else-if="enrollmentStatus === 'success' && enrollment">
            <!-- Sub-case: Active Course Selected -->
            <div v-if="enrollment.data">
              <DashboardTeacher
                v-if="enrollment.data.role === 'TEACHER' || enrollment.data.role === 'TA'"
                :course-title="enrollment.data.courseTitle"
                :course-code="enrollment.data.courseLabel"
                :is-admin="user?.globalRole === 'ADMIN'"
              />
              <DashboardStudent
                v-else-if="enrollment.data.role === 'STUDENT'"
                :course-title="enrollment.data.courseTitle"
                :course-code="enrollment.data.courseLabel"
                :is-admin="user?.globalRole === 'ADMIN'"
              />
            </div>

            <!-- Sub-case: No Active Course (Show List) -->
            <div v-else>
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold flex items-center gap-2">
                  <UIcon name="i-lucide-graduation-cap" class="text-primary-500" />
                  {{ t('pages.dashboard.list.title') }}
                </h2>
                <UButton
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
                  <div class="h-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
                </UCard>
              </div>

              <!-- Course Grid -->
              <div
                v-else-if="
                  coursesStatus === 'success' && courses && courses.data && courses.data.length > 0
                "
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

              <!-- Error courses list -->
              <UCard v-else-if="coursesStatus === 'error'" class="text-center py-12 border-red-200">
                <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p class="text-red-500 font-medium">{{ t('global.status.loadingFailed') }}</p>
                <UButton
                  class="mt-4"
                  variant="ghost"
                  color="red"
                  size="sm"
                  icon="i-lucide-refresh-cw"
                  @click="() => refreshCourses()"
                >
                  {{ t('global.actions.reset') }}
                </UButton>
              </UCard>

              <!-- Empty Courses State -->
              <UCard v-else-if="coursesStatus === 'success'" class="text-center py-12">
                <UIcon
                  name="i-lucide-book-open-x"
                  class="w-12 h-12 mx-auto mb-4 text-neutral-300"
                />
                <p class="text-neutral-500 font-medium">{{ t('global.empty.noCourses') }}</p>
              </UCard>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="enrollmentStatus === 'error'" class="max-w-2xl mx-auto py-24 text-center">
            <UIcon name="i-lucide-alert-triangle" class="w-16 h-16 mx-auto mb-6 text-red-500" />
            <h2 class="text-3xl font-bold mb-4">{{ t('global.status.error') }}</h2>
            <p class="text-lg text-neutral-600 dark:text-neutral-400">
              {{
                isUnauthorized(enrollmentError)
                  ? t('auth.login.messages.error.sessionExpired')
                  : t('global.status.loadingFailed')
              }}
            </p>
            <UButton
              v-if="!isUnauthorized(enrollmentError)"
              class="mt-8"
              icon="i-lucide-refresh-cw"
              @click="refreshEnrollment"
            >
              {{ t('global.actions.reset') }}
            </UButton>
            <UButton v-else class="mt-8" icon="i-lucide-log-in" to="/auth/login">
              {{ t('auth.login.submit') }}
            </UButton>
          </div>
        </template>
      </UContainer></UPageBody
    >
  </UPage>
</template>

<script lang="ts" setup>
import type { SimpleEnrollment } from '@@/shared/models/enrollment'
import type { ApiResponse } from '@@/shared/types/api'

// Composables
const { t } = useI18n()
const { loggedIn, user, clear } = useUserSession()

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
    console.error('Failed to select course:', e)
  } finally {
    selecting.value = null
  }
}

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
