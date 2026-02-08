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
                name="i-lucide-book-open"
                class="w-6 h-6 text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {{ t('pages.dashboard.student.title', { course: courseTitle }) }}
              </h2>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ t('pages.dashboard.student.subtitle') }}
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

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Tokens -->
        <UCard variant="ghost" class="bg-neutral-50 dark:bg-neutral-800/50">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium uppercase">
                {{ t('pages.dashboard.student.stats.availableTokens') }}
              </p>
              <p class="text-4xl font-bold text-primary-600 dark:text-primary-400 mt-1">3</p>
            </div>
            <div class="p-4 bg-primary-100 dark:bg-primary-900/50 rounded-full">
              <UIcon name="i-lucide-coins" class="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </UCard>

        <!-- Next Deadline -->
        <UCard variant="ghost" class="bg-neutral-50 dark:bg-neutral-800/50">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 font-medium uppercase">
                {{ t('pages.dashboard.student.stats.nextDeadline') }}
              </p>
              <p class="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                {{ t('global.empty.noUpcoming') }}
              </p>
            </div>
            <div class="p-4 bg-secondary-100 dark:bg-secondary-900/50 rounded-full">
              <UIcon
                name="i-lucide-calendar-clock"
                class="w-8 h-8 text-secondary-600 dark:text-secondary-400"
              />
            </div>
          </div>
        </UCard>
      </div>
    </UCard>

    <!-- My Assignments -->
    <UCard :title="t('pages.dashboard.student.assignments.title')">
      <div class="text-center py-12 text-neutral-500">
        <UIcon name="i-lucide-clipboard-check" class="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>{{ t('pages.dashboard.student.assignments.empty') }}</p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  courseTitle: string | null
  isAdmin: boolean
}>()
</script>
