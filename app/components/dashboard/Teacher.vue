<template>
  <div class="space-y-6">
    <UCard
      class="bg-white dark:bg-neutral-900 shadow-sm border-primary-200/60 dark:border-primary-700/60"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-graduation-cap"
                class="w-6 h-6 text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {{ t('pages.dashboard.teacher.title', { course: courseTitle }) }}
              </h2>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ t('pages.dashboard.teacher.subtitle') }}
              </p>
            </div>
          </div>
          <UButton
            v-if="isAdmin"
            to="/admin"
            icon="i-lucide-settings"
            color="secondary"
            variant="outline"
            :label="t('pages.admin.link')"
          />
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Quick Stats -->
        <UCard variant="ghost" class="bg-neutral-50 dark:bg-neutral-800/50">
          <div class="text-center py-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
              {{ t('pages.dashboard.teacher.stats.activeAssignments') }}
            </p>
            <p class="text-4xl font-bold text-primary-600 dark:text-primary-400 mt-1">0</p>
          </div>
        </UCard>

        <UCard variant="ghost" class="bg-neutral-50 dark:bg-neutral-800/50">
          <div class="text-center py-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
              {{ t('pages.dashboard.teacher.stats.pendingRequests') }}
            </p>
            <p class="text-4xl font-bold text-secondary-600 dark:text-secondary-400 mt-1">0</p>
          </div>
        </UCard>

        <UCard variant="ghost" class="bg-neutral-50 dark:bg-neutral-800/50">
          <div class="text-center py-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium lowercase">
              {{ t('pages.dashboard.teacher.stats.enrolledStudents') }}
            </p>
            <p class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">0</p>
          </div>
        </UCard>
      </div>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent Activity -->
      <UCard title="Recent Activity">
        <div class="text-center py-12 text-neutral-500">
          <UIcon name="i-lucide-history" class="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>{{ t('global.empty.noActivity') }}</p>
        </div>
      </UCard>

      <!-- Course Settings Quick Access -->
      <UCard title="Course Tools">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UButton
            block
            icon="i-lucide-plus-circle"
            variant="ghost"
            class="justify-start"
            :label="t('pages.dashboard.teacher.tools.newAssignment')"
          />
          <UButton
            block
            icon="i-lucide-users"
            variant="ghost"
            class="justify-start"
            :label="t('pages.dashboard.teacher.tools.manageStudents')"
          />
          <UButton
            block
            icon="i-lucide-clock"
            variant="ghost"
            class="justify-start"
            :label="t('pages.dashboard.teacher.tools.extensionPolicy')"
          />
          <UButton
            block
            icon="i-lucide-clipboard-list"
            variant="ghost"
            class="justify-start"
            :label="t('pages.dashboard.teacher.tools.gradingLog')"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  courseTitle: string | null
  isAdmin: boolean
}>()
</script>
