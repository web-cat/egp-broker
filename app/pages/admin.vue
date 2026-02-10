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
          <UNavigationMenu :items="adminLinks" orientation="vertical" />
        </UCard>

        <!-- Main Admin Content -->
        <div class="md:col-span-2 space-y-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UCard v-for="stat in stats" :key="stat.label" class="text-center">
              <p class="text-sm font-medium text-neutral-500 uppercase">{{ stat.label }}</p>
              <p class="text-3xl font-bold mt-2">{{ stat.value }}</p>
            </UCard>
          </div>

          <!-- LTI Platforms Table -->
          <UiDataTable
            :data="platforms?.data"
            :columns="platformColumns"
            :loading="platformsStatus === 'pending'"
            searchable
            search-placeholder="Search platforms…"
            empty-icon="i-lucide-layers"
            empty-text="No platforms registered yet."
          >
            <template #toolbar>
              <UButton icon="i-lucide-plus" label="Add Platform" />
            </template>
          </UiDataTable>
        </div>
      </div>
    </UContainer>
  </UPage>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ApiResponse } from '@@/shared/types/api'

const { t } = useI18n()

// SEO
useSeo('admin')

// Middleware to protect the route
definePageMeta({
  middleware: ['admin-only']
})

// --- LTI Platforms data ---

interface PlatformRow {
  id: string
  issuer: string
  clientId: string
  name: string | null
  deploymentCount: number
  createdAt: string
}

const UBadge = resolveComponent('UBadge')
const RowActions = resolveComponent('UiDataRowActions')

const { data: platforms, status: platformsStatus } = await useFetch<ApiResponse<PlatformRow[]>>(
  '/api/admin/platforms',
  { lazy: true }
)

const platformColumns: TableColumn<PlatformRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.getValue('name') || '—'
  },
  {
    accessorKey: 'issuer',
    header: 'Issuer',
    cell: ({ row }) => {
      const issuer = row.getValue('issuer') as string
      try {
        return new URL(issuer).hostname
      } catch {
        return issuer
      }
    }
  },
  {
    accessorKey: 'clientId',
    header: 'Client ID'
  },
  {
    accessorKey: 'deploymentCount',
    header: 'Deployments',
    cell: ({ row }) => {
      const count = row.getValue('deploymentCount') as number
      return h(UBadge, { variant: 'subtle', color: count > 0 ? 'success' : 'neutral' }, () =>
        String(count)
      )
    },
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.getValue('createdAt') as string).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
  },
  {
    id: 'actions',
    header: '',
    meta: { class: { td: 'text-right' } },
    cell: () =>
      h(RowActions, {
        items: [
          [
            { label: 'View deployments', icon: 'i-lucide-share-2' },
            { label: 'Edit', icon: 'i-lucide-pencil' }
          ],
          [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
        ]
      })
  }
]

// --- Sidebar & Stats ---

const adminLinks = [
  { label: 'Platforms', icon: 'i-lucide-layers', to: '#platforms' },
  { label: 'Deployments', icon: 'i-lucide-share-2', to: '/admin/deployments' },
  { label: 'Users', icon: 'i-lucide-users', to: '/admin/users' },
  { label: 'System Logs', icon: 'i-lucide-terminal', to: '/admin/logs' }
]

const stats = computed(() => [
  { label: 'Total Platforms', value: String(platforms.value?.data?.length ?? '—') },
  { label: 'Total Users', value: '0' }
])
</script>
