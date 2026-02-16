<template>
  <div>
    <BaseDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="toolColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search tools…"
      empty-icon="i-lucide-wrench"
      empty-text="No tools found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Tool" @click="openCreate" />
      </template>
    </BaseDataTable>

    <FeaturesAdminToolEditPanel
      v-model:open="editOpen"
      :tool="editingItem"
      :platform-id="createPlatformId"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ToolRow } from '@@/shared/models/tool'

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
} = useAdminCrud<ToolRow>('/api/admin/tools', { p: platformFilter })

const { deleteTool: apiDeleteTool } = useAdminTools()

// --- Page title ---
const { setTitle } = useAdminPageTitle()

watchEffect(() => {
  setTitle('LTI Tools')
})

const toolColumns: TableColumn<ToolRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.getValue('name') || '—'
  },
  {
    accessorKey: 'baseUrl',
    header: 'URL'
  },
  {
    accessorKey: 'protocol',
    header: 'Protocol',
    cell: ({ row }) =>
      h('UBadge', { variant: 'subtle', color: 'neutral' }, row.getValue('protocol') as string)
  },
  {
    accessorKey: 'platformIssuer',
    header: 'Platform',
    cell: ({ row }) => {
      const issuer = row.getValue('platformIssuer') as string | null
      if (!issuer) return '—'
      try {
        return new URL(issuer).hostname
      } catch {
        return issuer
      }
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<ToolRow>((row) => [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteTool(row.original)
      }
    ]
  ])
]

async function deleteTool(row: ToolRow) {
  if (!confirm('Are you sure you want to delete this tool?')) return

  try {
    await apiDeleteTool(row.id)
    onItemCreated() // Refresh table
    useToast().add({ title: 'Tool deleted' })
  } catch {
    useToast().add({ title: 'Error deleting tool', color: 'error' })
  }
}
</script>
