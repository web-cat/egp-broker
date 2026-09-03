<template>
  <UPage class="bg-primary-50/30 dark:bg-primary-950/30 min-h-screen">
    <UPageBody
      ><UContainer>
        <div class="flex items-center justify-between gap-4 pb-8">
          <UPageHeader :title="adminPageTitle || t('pages.admin.title')" class="!pb-0" />

          <UDropdownMenu :items="dropdownItems">
            <UButton
              :label="currentPageLabel"
              icon="i-lucide-chevron-down"
              trailing
              variant="outline"
              color="neutral"
            />
          </UDropdownMenu>
        </div>

        <NuxtPage /> </UContainer
    ></UPageBody>
  </UPage>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { title: adminPageTitle } = useAdminPageTitle()

// SEO
useSeo('admin')

// Middleware to protect the route
definePageMeta({
  middleware: ['admin-only']
})

// --- Navigation ---

const adminLinks = [
  { label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Assignments', icon: 'i-lucide-clipboard-list', to: '/admin/assignments' },
  { label: 'Courses', icon: 'i-lucide-book-open', to: '/admin/courses' },
  { label: 'Deployments', icon: 'i-lucide-share-2', to: '/admin/deployments' },
  { label: 'LTI Tools', icon: 'i-lucide-wrench', to: '/admin/tools' },
  { label: 'Platforms', icon: 'i-lucide-layers', to: '/admin/platforms' },
  { label: 'Testing Center', icon: 'i-lucide-building-2', to: '/admin/cbtf' },
  { label: 'Users', icon: 'i-lucide-users', to: '/admin/users' }
]

const dropdownItems = computed(() =>
  adminLinks.map((link) => ({
    label: link.label,
    icon: link.icon,
    onSelect: () => navigateTo(link.to)
  }))
)

const currentPageLabel = computed(() => {
  const match = adminLinks.find((link) => route.path === link.to)
  return match?.label ?? 'Show Details'
})
</script>
