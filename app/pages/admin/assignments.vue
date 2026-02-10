<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="assignments?.data"
      :columns="assignmentColumns"
      :loading="assignmentsStatus === 'pending'"
      searchable
      search-placeholder="Search assignments…"
      empty-icon="i-lucide-clipboard-list"
      empty-text="No assignments found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Assignment" @click="openCreate" />
      </template>
    </UiDataTable>

    <AdminAssignmentEditPanel
      v-model:open="editOpen"
      :assignment="editingAssignment"
      :course-id="createCourseId"
      @saved="onRowUpdated"
      @created="onAssignmentCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ApiResponse } from '@@/shared/types/api'

interface AssignmentRow {
  id: string
  resourceLinkId: string
  title: string | null
  canvasAssignmentId: string | null
  courseLabel: string | null
  courseTitle: string | null
  dueDate: string | null
  availableFrom: string | null
  acceptUntil: string | null
  createdAt: string
}

const RowActions = resolveComponent('UiDataRowActions')

const editOpen = ref(false)
const editingAssignment = ref<AssignmentRow | null>(null)
const createCourseId = ref<string | null>(null)
const tableKey = ref(0)

const route = useRoute()
const courseFilter = computed(() => route.query.c as string | undefined)

const { data: assignments, status: assignmentsStatus } = await useFetch<
  ApiResponse<AssignmentRow[]>
>('/api/admin/assignments', { lazy: true, query: { c: courseFilter } })

function openCreate() {
  editingAssignment.value = null
  editOpen.value = true
}

function openEdit(assignment: AssignmentRow) {
  editingAssignment.value = assignment
  editOpen.value = true
}

function onRowUpdated(id: string, updates: Partial<AssignmentRow>) {
  const rows = assignments.value?.data
  if (!rows) return
  const idx = rows.findIndex((r) => r.id === id)
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...updates }
    tableKey.value++
  }
}

async function onAssignmentCreated() {
  const fresh = await $fetch<ApiResponse<AssignmentRow[]>>('/api/admin/assignments', {
    query: { c: courseFilter.value }
  })
  assignments.value = fresh
  tableKey.value++
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const assignmentColumns: TableColumn<AssignmentRow>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'courseLabel',
    header: 'Course',
    cell: ({ row }) => {
      const label = row.getValue('courseLabel') as string | null
      const title = row.original.courseTitle
      return label || title || '—'
    }
  },
  {
    accessorKey: 'resourceLinkId',
    header: 'Resource Link ID'
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }) => formatDate(row.getValue('dueDate') as string | null)
  },
  {
    accessorKey: 'availableFrom',
    header: 'Available From',
    cell: ({ row }) => formatDate(row.getValue('availableFrom') as string | null)
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDate(row.getValue('createdAt') as string)
  },
  {
    id: 'actions',
    header: '',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) =>
      h(RowActions, {
        items: [
          [
            { label: 'View course', icon: 'i-lucide-book-open' },
            { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
          ],
          [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
        ]
      })
  }
]
</script>
