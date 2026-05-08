<template>
  <div>
    <BaseDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="platformColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search platforms…"
      empty-icon="i-lucide-layers"
      empty-text="No platforms registered yet."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Platform" @click="openCreate" />
      </template>
    </BaseDataTable>

    <FeaturesAdminPlatformEditPanel
      v-model:open="editOpen"
      :platform="editingItem"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface PlatformRow {
  id: string
  issuer: string
  clientId: string
  name: string | null
  deploymentCount: number
  createdAt: string
  authEndpoint: string
  tokenEndpoint: string
  jwksEndpoint: string
}

// --- Page title ---
const { setTitle } = useAdminPageTitle()
setTitle('Platforms')

// --- Notifications ---
const route = useRoute()
const toast = useToast()

onMounted(() => {
  if (route.query.error) {
    toast.add({
      title: 'Action Required',
      description: route.query.error as string,
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
      timeout: 10000
    })
    // Clear the error from the URL
    navigateTo({ path: route.path, query: {} }, { replace: true })
  }
})

// --- Data & CRUD ---
const {
  data,
  status,
  editOpen,
  editingItem,
  tableKey,
  openCreate,
  openEdit,
  onRowUpdated,
  onItemCreated
} = useAdminCrud<PlatformRow>('/api/admin/platforms')

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
    cell: countBadgeCell('deploymentCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<PlatformRow>((row) => [
    [
      {
        label: 'View courses',
        icon: 'i-lucide-book-open',
        onSelect: () => navigateTo({ path: '/admin/courses', query: { p: row.original.id } })
      },
      {
        label: 'View deployments',
        icon: 'i-lucide-share-2',
        onSelect: () => navigateTo({ path: '/admin/deployments', query: { p: row.original.id } })
      },
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        onSelect: () => openEdit(row.original)
      }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>
