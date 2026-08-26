<template>
  <UModal
    :open="open"
    :title="`Pass History: ${student?.studentName || ''}`"
    :description="
      student?.studentEmail
        ? `${student.studentEmail}${student.sectionName ? ' • ' + student.sectionName : ''}`
        : 'Student redemption history'
    "
    :ui="{ content: 'max-w-4xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Pass Balances Summary -->
        <div
          v-if="student?.passBalances?.length"
          class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
        >
          <p
            class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3"
          >
            Current Pass Balances
          </p>
          <div class="flex flex-wrap gap-3">
            <div
              v-for="pb in student.passBalances"
              :key="pb.passTypeId"
              class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs"
            >
              <UIcon
                name="i-lucide-ticket"
                class="w-4 h-4 text-primary-600 dark:text-primary-400"
              />
              <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {{ pb.passTypeName }}:
              </span>
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {{ pb.balance }}
                <span class="text-xs font-normal text-neutral-400">/ {{ pb.initialBalance }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Redemption Log Table -->
        <div class="space-y-2">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1"
          >
            Redemption Log
          </p>
          <BaseDataTable
            :data="redemptions"
            :columns="columns"
            :loading="loading"
            searchable
            search-placeholder="Search assignments…"
            empty-icon="i-lucide-history"
            empty-text="No pass redemptions recorded for this student."
          />
        </div>
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
import type { StudentRosterRow, StudentRedemptionHistoryRow } from '@@/shared/models/teacher'
import { formatDate } from '~/utils/date'

const props = defineProps<{
  open: boolean
  student: StudentRosterRow | null
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()

const redemptions = ref<StudentRedemptionHistoryRow[]>([])
const loading = ref(false)

const fetchRedemptions = async () => {
  if (!props.student?.userId) return
  loading.value = true
  try {
    const res = await $fetch<{ data: StudentRedemptionHistoryRow[] }>(
      `/api/me/students/${props.student.userId}/redemptions`
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
  () => [props.open, props.student?.userId],
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
    accessorKey: 'assignmentTitle',
    header: 'Assignment',
    cell: ({ row }: { row: any }) => {
      return h(
        'span',
        { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
        row.getValue('assignmentTitle') || '—'
      )
    }
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
