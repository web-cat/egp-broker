<template>
  <div>
    <BaseDataTable
      :data="servers?.data"
      :columns="columns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search CAS servers…"
      empty-icon="i-lucide-building-2"
      empty-text="No CAS servers configured."
    >
      <template #toolbar>
        <UButton
          icon="i-lucide-plus"
          :label="t('admin.casServer.panelTitleCreate')"
          @click="openCreatePanel"
        />
      </template>
    </BaseDataTable>

    <CasServerEditPanel
      v-model:open="isPanelOpen"
      :cas-server="selectedServer"
      @saved="onServerSaved"
      @created="onServerCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CasServerAdminRow } from '@@/shared/schemas/cas.schema'
import CasServerEditPanel from '@@/app/components/features/admin/CasServerEditPanel.vue'

// --- Page title ---
const { setTitle } = useAdminPageTitle()
const { t } = useI18n()
setTitle(t('admin.casServer.title'))

// --- Data fetching ---
const { fetchCasServers, deleteCasServer } = useAdminCasServers()
const { data: servers, status, refresh } = await fetchCasServers()
const toast = useToast()

// --- State ---
const isPanelOpen = ref(false)
const selectedServer = ref<CasServerAdminRow | null>(null)

// --- Columns ---
const columns: TableColumn<CasServerAdminRow>[] = [
  {
    accessorKey: 'name',
    header: t('admin.casServer.nameLabel')
  },
  {
    accessorKey: 'baseUrl',
    header: t('admin.casServer.baseUrlLabel')
  },
  {
    accessorKey: 'serviceValidateVersion',
    header: t('admin.casServer.versionLabel'),
    cell: ({ row }) => `CAS ${row.original.serviceValidateVersion}`
  },
  {
    accessorKey: 'identityCount',
    header: 'Linked Users',
    cell: countBadgeCell('identityCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<CasServerAdminRow>((row) => [
    [
      {
        label: t('global.actions.edit'),
        icon: 'i-lucide-pencil',
        onSelect: () => openEditPanel(row.original)
      }
    ],
    [
      {
        label: t('global.actions.delete'),
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => confirmDelete(row.original)
      }
    ]
  ])
]

// --- Actions ---
function openCreatePanel() {
  selectedServer.value = null
  isPanelOpen.value = true
}

function openEditPanel(server: CasServerAdminRow) {
  selectedServer.value = { ...server }
  isPanelOpen.value = true
}

function onServerCreated() {
  refresh()
}

function onServerSaved(id: string, updates: CasServerAdminRow) {
  if (servers.value?.data) {
    const idx = servers.value.data.findIndex((s) => s.id === id)
    if (idx !== -1) {
      servers.value.data[idx] = { ...servers.value.data[idx], ...updates }
    }
  }
}

async function confirmDelete(server: CasServerAdminRow) {
  if (!confirm(`Are you sure you want to delete ${server.name}?`)) return

  try {
    await deleteCasServer(server.id)
    toast.add({
      title: t('admin.casServer.notifications.deletedTitle'),
      description: t('admin.casServer.notifications.deletedMessage')
    })
    refresh()
  } catch (error: any) {
    toast.add({
      title: t('admin.casServer.notifications.errorDefault'),
      description: error.message || 'Server might still be in use.',
      color: 'error'
    })
  }
}
</script>
