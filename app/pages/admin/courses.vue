<template>
  <div>
    <UiDataTable
      :key="tableKey"
      :data="courses?.data"
      :columns="courseColumns"
      :loading="coursesStatus === 'pending'"
      searchable
      search-placeholder="Search courses…"
      empty-icon="i-lucide-book-open"
      empty-text="No courses found."
    >
      <template #toolbar>
        <UButton icon="i-lucide-plus" label="Add Course" @click="openCreate" />
      </template>
    </UiDataTable>

    <AdminCourseEditPanel
      v-model:open="editOpen"
      :course="editingCourse"
      @saved="onRowUpdated"
      @created="onCourseCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ApiResponse } from '@@/shared/types/api'

interface CourseRow {
  id: string
  ltiContextId: string
  label: string | null
  title: string | null
  enrollmentCount: number
  assignmentCount: number
  createdAt: string
}

const UBadge = resolveComponent('UBadge')
const RowActions = resolveComponent('UiDataRowActions')

const editOpen = ref(false)
const editingCourse = ref<CourseRow | null>(null)
const tableKey = ref(0)

const route = useRoute()
const deploymentFilter = computed(() => route.query.d as string | undefined)
const platformFilter = computed(() => route.query.p as string | undefined)

const { data: courses, status: coursesStatus } = await useFetch<ApiResponse<CourseRow[]>>(
  '/api/admin/courses',
  { lazy: true, query: { d: deploymentFilter, p: platformFilter } }
)

function openCreate() {
  editingCourse.value = null
  editOpen.value = true
}

function openEdit(course: CourseRow) {
  editingCourse.value = course
  editOpen.value = true
}

function onRowUpdated(id: string, updates: Partial<CourseRow>) {
  const rows = courses.value?.data
  if (!rows) return
  const idx = rows.findIndex((r) => r.id === id)
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...updates }
    tableKey.value++
  }
}

async function onCourseCreated() {
  const fresh = await $fetch<ApiResponse<CourseRow[]>>('/api/admin/courses', {
    query: { d: deploymentFilter.value, p: platformFilter.value }
  })
  courses.value = fresh
  tableKey.value++
}

const courseColumns: TableColumn<CourseRow>[] = [
  {
    accessorKey: 'label',
    header: 'Code',
    cell: ({ row }) => row.getValue('label') || '—'
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'ltiContextId',
    header: 'LTI Context ID'
  },
  {
    accessorKey: 'enrollmentCount',
    header: 'Enrollments',
    cell: ({ row }) => {
      const count = row.getValue('enrollmentCount') as number
      return h(UBadge, { variant: 'subtle', color: count > 0 ? 'success' : 'neutral' }, () =>
        String(count)
      )
    },
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'assignmentCount',
    header: 'Assignments',
    cell: ({ row }) => {
      const count = row.getValue('assignmentCount') as number
      return h(UBadge, { variant: 'subtle', color: count > 0 ? 'info' : 'neutral' }, () =>
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
    cell: ({ row }) =>
      h(RowActions, {
        items: [
          [
            { label: 'View enrollments', icon: 'i-lucide-users' },
            {
              label: 'View assignments',
              icon: 'i-lucide-clipboard-list',
              onSelect: () =>
                navigateTo({ path: '/admin/assignments', query: { c: row.original.label } })
            },
            { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) }
          ],
          [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
        ]
      })
  }
]
</script>
