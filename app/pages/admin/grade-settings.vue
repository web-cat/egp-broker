<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="toolColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search LTI Tools..."
      empty-icon="i-lucide-wrench"
      empty-text="No LTI tools configured."
    >
      <template #toolbar>
        <div class="flex items-center justify-between w-full">
          <UButton icon="i-lucide-plus" label="Add Tool" @click="openCreate" />
        </div>
      </template>
    </UiDataTable>

    <AdminToolGradeEditPanel
      v-model:open="editOpen"
      :tool="editingItem"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

// Define the shape of our LTI Tool + Grade Policy
interface ToolGradeRow {
  id: string
  name: string | null
  issuer: string
  clientId: string
  modifierType: 'NONE' | 'flat_bonus' | 'percent_multiplier'
  modifierValue: number
  updatedAt: string
}

const {
  data,
  status,
  editOpen,
  editingItem,
  tableKey,
  openCreate, // Used by the "Add Tool" button
  openEdit,
  onRowUpdated,
  onItemCreated
} = useAdminCrud<ToolGradeRow>('/api/admin/lti-tools')

const toolColumns: TableColumn<ToolGradeRow>[] = [
  {
    accessorKey: 'name',
    header: 'Tool Name',
    cell: ({ row }) => row.getValue('name') || row.original.issuer
  },
  {
    accessorKey: 'modifierType',
    header: 'Grading Policy',
    cell: ({ row }) => {
      const type = row.original.modifierType
      if (!type || type === 'NONE') return 'Standard (Pass-through)'
      return type === 'flat_bonus' ? 'Flat Bonus' : 'Multiplier'
    }
  },
  {
    accessorKey: 'modifierValue',
    header: 'Adjustment',
    cell: ({ row }) => {
      const val = row.original.modifierValue
      const type = row.original.modifierType
      if (!type || type === 'NONE') return '—'
      return type === 'percent_multiplier' ? `${val}x` : `+${val} pts`
    }
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Sync',
    cell: dateCellRenderer('updatedAt')
  },
  actionsColumn<ToolGradeRow>((row) => [
    [
      { 
        label: 'Edit Configuration', 
        icon: 'i-lucide-pencil', 
        onSelect: () => openEdit(row.original) 
      }
    ],
    [{ label: 'Delete Tool', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>