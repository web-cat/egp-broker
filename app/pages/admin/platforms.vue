<template>
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
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ApiResponse } from '@@/shared/types/api'

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
</script>
