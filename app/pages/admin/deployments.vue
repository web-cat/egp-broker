<template>
  <div>
    <BaseDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="deploymentColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search deployments…"
      empty-icon="i-lucide-share-2"
      empty-text="No deployments found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Deployment" @click="openCreate" />
      </template>
    </BaseDataTable>

    <FeaturesAdminDeploymentEditPanel
      v-model:open="editOpen"
      :deployment="editingItem"
      :platform-id="createPlatformId"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface DeploymentRow {
  id: string
  platformId: string
  deploymentId: string
  deploymentHost: string | null
  platformName: string | null
  platformIssuer: string
  courseCount: number
  createdAt: string
}

const route = useRoute()
const platformFilter = computed(() => route.query.p as string | undefined)
const createPlatformId = computed(() => platformFilter.value ?? null)

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
} = useAdminCrud<DeploymentRow>('/api/admin/deployments', { p: platformFilter })

// --- Page title ---
const { setTitle } = useAdminPageTitle()

watchEffect(() => {
  if (!platformFilter.value) {
    setTitle('Deployments')
    return
  }
  const firstRow = data.value?.data?.[0]
  const name = firstRow?.platformName
  const issuer = firstRow?.platformIssuer
  const host =
    name ||
    (issuer
      ? (() => {
          try {
            return new URL(issuer).hostname
          } catch {
            return issuer
          }
        })()
      : null)
  setTitle(host ? `Deployments: ${host}` : 'Deployments')
})

const deploymentColumns: TableColumn<DeploymentRow>[] = [
  {
    accessorKey: 'deploymentId',
    header: 'Deployment ID'
  },
  {
    accessorKey: 'deploymentHost',
    header: 'Host',
    cell: ({ row }) => row.getValue('deploymentHost') || '—'
  },
  {
    accessorKey: 'platformName',
    header: 'Platform',
    cell: ({ row }) => row.getValue('platformName') || '—'
  },
  {
    accessorKey: 'platformIssuer',
    header: 'Issuer',
    cell: ({ row }) => {
      const issuer = row.getValue('platformIssuer') as string
      try {
        return new URL(issuer).hostname
      } catch {
        return issuer
      }
    }
  },
  {
    accessorKey: 'courseCount',
    header: 'Courses',
    cell: countBadgeCell('courseCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<DeploymentRow>((row) => [
    [
      {
        label: 'View courses',
        icon: 'i-lucide-book-open',
        onSelect: () =>
          navigateTo({ path: '/admin/courses', query: { d: row.original.deploymentId } })
      },
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>
