<template>
  <UModal
    :open="open"
    :title="`Assignment Details: ${assignment?.title || ''}`"
    :description="`Master deadlines, Canvas section/student overrides, and student pass redemptions.`"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Associated LTI Tool -->
        <div
          class="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50"
        >
          <div class="flex items-center gap-2.5">
            <UIcon name="i-lucide-wrench" class="w-4 h-4 text-primary-500" />
            <span
              class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              LTI Tool:
            </span>
            <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ assignment?.toolName || 'None' }}
            </span>
          </div>
          <UBadge v-if="assignment?.toolName" color="primary" variant="subtle" size="xs">
            <UIcon name="i-lucide-link" class="w-3 h-3 mr-1" />
            Connected
          </UBadge>
          <UBadge v-else color="neutral" variant="subtle" size="xs"> Not Configured </UBadge>
        </div>

        <!-- Master Assignment Baseline Dates Card -->
        <div
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4
              class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              Master Default Schedule
            </h4>
            <UBadge
              v-if="assignment?.published === false"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              <UIcon name="i-lucide-eye-off" class="w-3 h-3 mr-1 text-neutral-500" />
              Unpublished
            </UBadge>
            <UBadge v-else color="success" variant="subtle" size="xs">
              <UIcon name="i-lucide-check" class="w-3 h-3 mr-1" />
              Published
            </UBadge>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block"
                >Available From</span
              >
              <span class="font-medium text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.availableFrom) || '—' }}
              </span>
            </div>
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block">Due Date</span>
              <span class="font-semibold text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.dueDate) || '—' }}
              </span>
            </div>
            <div>
              <span class="text-neutral-500 dark:text-neutral-400 text-xs block"
                >Accept Until (Cutoff)</span
              >
              <span class="font-medium text-neutral-900 dark:text-neutral-100">
                {{ formatDate(assignment?.acceptUntil) || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Canvas Overrides Table -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4
              class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
            >
              <UIcon name="i-lucide-calendar-clock" class="w-4 h-4 text-primary-500" />
              Canvas Section & Individual Overrides ({{ overrides.length }})
            </h4>
          </div>
          <BaseDataTable
            :data="overrides"
            :columns="overrideColumns"
            :loading="loadingOverrides"
            searchable
            search-placeholder="Search overrides…"
            empty-icon="i-lucide-calendar-x"
            empty-text="No section or individual student overrides configured on Canvas."
          />
        </div>

        <!-- Student Pass Redemptions Table -->
        <div class="space-y-3 pt-2">
          <div class="flex items-center justify-between">
            <h4
              class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
            >
              <UIcon name="i-lucide-ticket" class="w-4 h-4 text-primary-500" />
              Student Pass Redemptions ({{ redemptions.length }})
            </h4>
          </div>
          <BaseDataTable
            :data="redemptions"
            :columns="redemptionColumns"
            :loading="loadingRedemptions"
            searchable
            search-placeholder="Search students or passes…"
            empty-icon="i-lucide-history"
            empty-text="No pass redemptions found for this assignment."
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
import type { AssignmentRedemptionRow } from '@@/shared/models/teacher'
import type { AssignmentOverrideDetails } from '@@/shared/models/override'
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
const overrides = ref<AssignmentOverrideDetails[]>([])
const loadingRedemptions = ref(false)
const loadingOverrides = ref(false)

const fetchData = async () => {
  if (!props.assignment?.id) return
  loadingRedemptions.value = true
  loadingOverrides.value = true

  try {
    const [redemptionRes, overrideRes] = await Promise.all([
      $fetch<{ data: AssignmentRedemptionRow[] }>(
        `/api/me/assignments/${props.assignment.id}/redemptions`
      ).catch(() => ({ data: [] })),
      $fetch<{ data: AssignmentOverrideDetails[] }>(
        `/api/me/assignments/${props.assignment.id}/overrides`
      ).catch(() => ({ data: [] }))
    ])
    redemptions.value = redemptionRes.data || []
    overrides.value = overrideRes.data || []
  } catch (err) {
    console.error(err)
    redemptions.value = []
    overrides.value = []
  } finally {
    loadingRedemptions.value = false
    loadingOverrides.value = false
  }
}

watch(
  () => [props.open, props.assignment?.id],
  ([isOpen, id]) => {
    if (isOpen && id) {
      fetchData()
    } else {
      redemptions.value = []
      overrides.value = []
    }
  },
  { immediate: true }
)

const overrideColumns: any[] = [
  {
    accessorKey: 'targetName',
    header: 'Target / Scope',
    cell: ({ row }: { row: any }) => {
      const isSection = row.original.type === 'SECTION'
      return h('div', { class: 'flex items-center gap-2' }, [
        h(resolveComponent('UIcon'), {
          name: isSection ? 'i-lucide-users' : 'i-lucide-user',
          class: 'w-4 h-4 text-neutral-500'
        }),
        h(
          'span',
          { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
          row.getValue('targetName')
        )
      ])
    }
  },
  {
    accessorKey: 'title',
    header: 'Override Title',
    cell: ({ row }: { row: any }) => row.getValue('title') || '—'
  },
  {
    accessorKey: 'availableFrom',
    header: 'Available From',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('availableFrom')) || '—'
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }: { row: any }) => {
      const formatted = formatDate(row.getValue('dueDate')) || '—'
      return h('span', { class: 'font-semibold text-neutral-900 dark:text-neutral-100' }, formatted)
    }
  },
  {
    accessorKey: 'acceptUntil',
    header: 'Accept Until',
    cell: ({ row }: { row: any }) => formatDate(row.getValue('acceptUntil')) || '—'
  }
]

const redemptionColumns: any[] = [
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
