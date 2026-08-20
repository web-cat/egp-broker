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

    <BaseConfirmationModal
      v-model:open="deleteOpen"
      title="Delete Platform"
      :description="`Are you sure you want to delete ${deletingItem?.name || deletingItem?.issuer || 'this platform'}?`"
      confirm-label="Delete Platform"
      confirm-color="error"
      confirm-icon="i-lucide-trash-2"
      :loading="isDeleting"
      @confirm="handleDeleteConfirm"
    >
      <p class="text-sm text-neutral-500">
        This will permanently delete the platform registration and may cascade to its associated
        deployments and identities. This action cannot be undone.
      </p>
    </BaseConfirmationModal>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PlatformRow } from '@@/shared/models/platform'

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
  deleteOpen,
  deletingItem,
  tableKey,
  openCreate,
  openEdit,
  openDelete,
  onRowUpdated,
  onRowDeleted,
  onItemCreated
} = useAdminCrud<PlatformRow>('/api/admin/platforms')

const isDeleting = ref(false)

async function handleDeleteConfirm() {
  if (!deletingItem.value) return
  isDeleting.value = true
  const target = deletingItem.value
  try {
    await $fetch(`/api/admin/platforms/${target.id}`, {
      method: 'DELETE'
    })
    onRowDeleted(target.id)
    deleteOpen.value = false
    toast.add({
      title: 'Platform Deleted',
      description: `Successfully deleted platform ${target.name || target.issuer}`,
      color: 'success'
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string; message?: string } }
    toast.add({
      title: 'Failed to delete platform',
      description:
        fetchErr.data?.statusMessage || fetchErr.data?.message || 'An unexpected error occurred.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

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
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => openDelete(row.original)
      }
    ]
  ])
]
</script>
