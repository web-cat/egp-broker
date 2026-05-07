<template>
  <div>
    <BaseDataTable
      :key="tableKey"
      :data="data?.data"
      :columns="translationColumns"
      :loading="status === 'pending'"
      searchable
      search-placeholder="Search translations…"
      empty-icon="i-lucide-calculator"
      empty-text="No grade translations found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Translation" @click="openCreate" />
      </template>
    </BaseDataTable>

    <FeaturesAdminGradeTranslationEditPanel
      v-model:open="editOpen"
      :translation="editingItem"
      @saved="onRowUpdated"
      @created="onItemCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

// Replace with your actual model type once defined in shared/models
interface GradeTranslationRow {
  id: string
  name: string
  description: string | null
  createdAt: string
}

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
} = useAdminCrud<GradeTranslationRow>('/api/admin/grade-translations')

const { setTitle } = useAdminPageTitle()
watchEffect(() => setTitle('Grade Translations'))

const translationColumns: TableColumn<GradeTranslationRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => h('span', { class: 'font-medium text-primary' }, row.getValue('name'))
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => row.getValue('description') || '—'
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<GradeTranslationRow>((row) => [
    [{ label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => deleteTranslation(row.original)
      }
    ]
  ])
]

async function deleteTranslation(row: GradeTranslationRow) {
  if (
    !confirm(
      'Are you sure you want to delete this translation? This may affect existing assignments.'
    )
  )
    return

  try {
    await $fetch(`/api/admin/grade-translations/${row.id}`, { method: 'DELETE' })
    onItemCreated()
    useToast().add({ title: 'Translation deleted' })
  } catch {
    useToast().add({ title: 'Error deleting translation', color: 'error' })
  }
}
</script>
