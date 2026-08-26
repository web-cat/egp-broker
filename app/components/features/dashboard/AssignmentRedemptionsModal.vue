<template>
  <UModal
    :open="open"
    :title="`Pass Redemptions: ${assignment?.title || ''}`"
    :description="`Student pass redemptions applied to this assignment.`"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <BaseDataTable
          :data="redemptions"
          :columns="columns"
          :loading="loading"
          searchable
          search-placeholder="Search students or passes…"
          empty-icon="i-lucide-history"
          empty-text="No pass redemptions found for this assignment."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          label="Close"
          color="neutral"
          variant="outline"
          @click="$emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { AssignmentRedemptionRow } from '@@/shared/models/teacher'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { formatDate } from '~/utils/date'

const props = defineProps<{
  open: boolean
  assignment: AssignmentRow | null
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()

const redemptions = ref<AssignmentRedemptionRow[]>([])
const loading = ref(false)

const fetchRedemptions = async () => {
  if (!props.assignment?.id) return
  loading.value = true
  try {
    const res = await $fetch<{ data: AssignmentRedemptionRow[] }>(
      `/api/me/assignments/${props.assignment.id}/redemptions`
    )
    redemptions.value = res.data || []
  } catch (err) {
    console.error(err)
    redemptions.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.assignment?.id],
  ([isOpen, id]) => {
    if (isOpen && id) {
      fetchRedemptions()
    } else {
      redemptions.value = []
    }
  },
  { immediate: true }
)

const columns: any[] = [
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) => {
      const name = row.getValue('studentName') || '—'
      const email = row.original.studentEmail
      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium text-neutral-900 dark:text-neutral-100' }, name),
        email && h('span', { class: 'text-xs text-neutral-500 dark:text-neutral-400' }, email)
      ])
    }
  },
  {
    accessorKey: 'sectionName',
    header: 'Section',
    cell: ({ row }: { row: any }) => row.getValue('sectionName') || '—'
  },
  {
    accessorKey: 'passTypeName',
    header: 'Pass Type',
    cell: ({ row }: { row: any }) => {
      return h(
        'span',
        {
          class: 'inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400'
        },
        [
          h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-3.5 h-3.5' }),
          row.getValue('passTypeName')
        ]
      )
    }
  },
  {
    accessorKey: 'cost',
    header: 'Cost',
    cell: ({ row }: { row: any }) => `${row.getValue('cost')} pass(es)`
  },
  {
    accessorKey: 'redeemedAt',
    header: 'Redeemed',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('redeemedAt')) || '—'
  },
  {
    accessorKey: 'dueDate',
    header: 'New Deadline',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('dueDate')) || '—'
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }: { row: any }) => {
      const active = row.getValue('isActive')
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('div', {
          class: [
            'w-2 h-2 rounded-full',
            active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
          ]
        }),
        h(
          'span',
          {
            class: active
              ? 'text-green-600 dark:text-green-400 font-medium text-xs'
              : 'text-neutral-500 text-xs'
          },
          active ? 'Active' : 'Expired'
        )
      ])
    }
  }
]
</script>
