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
import { h, resolveComponent } from 'vue'
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

const { deleteTool: apiDeleteTool, registerPassPort } = useAdminTools()

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
    id: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const badges = []
      if (row.original.supportsProxy) {
        badges.push(
          h(
            resolveComponent('UBadge'),
            { variant: 'subtle', color: 'neutral', size: 'xs' },
            () => 'Proxy'
          )
        )
      }
      if (row.original.supportsPassport) {
        badges.push(
          h(
            resolveComponent('UBadge'),
            { variant: 'subtle', color: 'primary', size: 'xs' },
            () => 'PassPort'
          )
        )
      }
      return badges.length > 0 ? h('div', { class: 'flex items-center gap-1' }, badges) : '—'
    }
  },
  {
    accessorKey: 'passportRegistrationStatus',
    header: 'PassPort Status',
    cell: ({ row }) => {
      if (!row.original.supportsPassport) return '—'

      const status = row.original.passportRegistrationStatus
      const err = row.original.passportRegistrationError

      switch (status) {
        case 'REGISTERED':
          return h(
            resolveComponent('UBadge'),
            { color: 'success', variant: 'subtle', icon: 'i-lucide-check-circle' },
            () => 'Registered'
          )
        case 'PENDING':
          return h(
            resolveComponent('UBadge'),
            { color: 'info', variant: 'subtle', icon: 'i-lucide-clock' },
            () => 'Pending'
          )
        case 'FAILED':
          return h(
            resolveComponent('UBadge'),
            {
              color: 'error',
              variant: 'subtle',
              icon: 'i-lucide-alert-circle',
              title: err || 'Registration failed'
            },
            () => (err ? `Failed: ${err}` : 'Failed')
          )
        case 'NOT_REGISTERED':
        default:
          return h(
            resolveComponent('UBadge'),
            { color: 'neutral', variant: 'subtle', icon: 'i-lucide-circle-dashed' },
            () => 'Not Registered'
          )
      }
    }
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
  actionsColumn<ToolRow>((row) => {
    const actions: any[][] = [
      [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }]
    ]

    if (row.original.supportsPassport) {
      actions.push([
        {
          label: 'Register with PassPort',
          icon: 'i-lucide-send',
          onSelect: () => handleRegisterPassPort(row.original)
        }
      ])
    }

    actions.push([
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteTool(row.original)
      }
    ])

    return actions
  })
]

async function handleRegisterPassPort(tool: ToolRow) {
  const toast = useToast()
  try {
    toast.add({
      id: 'passport-registration',
      title: 'Initiating PassPort registration...',
      color: 'info'
    })
    await registerPassPort(tool.id)
    toast.add({
      id: 'passport-registration',
      title: 'PassPort registration initiated',
      color: 'success'
    })
    onItemCreated() // Refresh table
  } catch (err: any) {
    const errorMsg =
      err?.data?.statusMessage ||
      err?.data?.message ||
      err?.message ||
      'Failed to initiate registration'
    toast.add({
      id: 'passport-registration',
      title: 'PassPort registration failed',
      description: errorMsg,
      color: 'error'
    })
    onItemCreated() // Refresh table
  }
}

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
