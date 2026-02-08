<template>
  <UPage class="bg-primary-50/30 dark:bg-primary-950/30 min-h-screen">
    <UPageHero
      :title="t('pages.admin.title')"
      :description="t('pages.admin.subtitle')"
      color="secondary"
    />

    <USeparator color="secondary" />

    <UContainer class="py-12">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Sidebar Navigation -->
        <UCard class="md:col-span-1">
          <UNavigationTree :links="adminLinks" />
        </UCard>

        <!-- Main Admin Content -->
        <div class="md:col-span-2 space-y-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UCard v-for="stat in stats" :key="stat.label" class="text-center">
              <p class="text-sm font-medium text-neutral-500 uppercase">{{ stat.label }}</p>
              <p class="text-3xl font-bold mt-2">{{ stat.value }}</p>
            </UCard>
          </div>

          <UCard title="System Activity">
            <div class="text-center py-12 text-neutral-500">
              <UIcon name="i-lucide-activity" class="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{{ t('global.empty.noActivity') }}</p>
            </div>
          </UCard>
        </div>
      </div>
    </UContainer>
  </UPage>
</template>

<script setup lang="ts">
const { t } = useI18n()

// SEO
useSeo('admin')

// Middleware to protect the route
definePageMeta({
  middleware: ['admin-only']
})

const adminLinks = [
  {
    label: 'Platforms',
    icon: 'i-lucide-layers',
    to: '/admin/platforms'
  },
  {
    label: 'Deployments',
    icon: 'i-lucide-share-2',
    to: '/admin/deployments'
  },
  {
    label: 'Users',
    icon: 'i-lucide-users',
    to: '/admin/users'
  },
  {
    label: 'System Logs',
    icon: 'i-lucide-terminal',
    to: '/admin/logs'
  }
]

const stats = [
  { label: 'Total Platforms', value: '0' },
  { label: 'Total Users', value: '0' }
]
</script>
