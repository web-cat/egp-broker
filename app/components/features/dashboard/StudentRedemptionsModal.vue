<template>
  <UModal
    :open="open"
    :title="`Pass History: ${student?.studentName || ''}`"
    :description="studentDescription"
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
          <div class="flex items-center justify-between mb-3">
            <p
              class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              Current Pass Balances
            </p>
            <div v-if="!isEditingBalances">
              <UButton
                size="xs"
                variant="ghost"
                color="primary"
                icon="i-lucide-pencil"
                label="Edit Balances"
                @click="startEditingBalances"
              />
            </div>
            <div v-else class="flex items-center gap-2">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                label="Cancel"
                :disabled="savingBalances"
                @click="cancelEditingBalances"
              />
              <UButton
                size="xs"
                color="primary"
                label="Save"
                icon="i-lucide-check"
                :loading="savingBalances"
                @click="saveBalances"
              />
            </div>
          </div>

          <!-- Read-only View -->
          <div v-if="!isEditingBalances" class="flex flex-wrap gap-3">
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

          <!-- Edit Mode View -->
          <div v-else class="flex flex-wrap gap-3">
            <div
              v-for="pb in student.passBalances"
              :key="pb.passTypeId"
              class="flex items-center gap-3 px-3 py-2 rounded-md bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 shadow-xs"
            >
              <div class="flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-ticket"
                  class="w-4 h-4 text-primary-600 dark:text-primary-400"
                />
                <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {{ pb.passTypeName }}:
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-minus"
                  :disabled="savingBalances || (editableBalances[pb.passTypeId] ?? 0) <= 0"
                  @click="
                    editableBalances[pb.passTypeId] = Math.max(
                      0,
                      (editableBalances[pb.passTypeId] ?? 0) - 1
                    )
                  "
                />
                <UInput
                  v-model.number="editableBalances[pb.passTypeId]"
                  type="number"
                  min="0"
                  max="1000"
                  class="w-16 text-center font-bold"
                  size="xs"
                  :disabled="savingBalances"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-plus"
                  :disabled="savingBalances"
                  @click="
                    editableBalances[pb.passTypeId] = (editableBalances[pb.passTypeId] ?? 0) + 1
                  "
                />
              </div>
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
import type {
  StudentRosterRow,
  StudentRedemptionHistoryRow,
  StudentPassBalance
} from '@@/shared/models/teacher'
import type { ApiResponse } from '@@/shared/types/api'
import { formatDate } from '~/utils/date'

const props = defineProps<{
  open: boolean
  student: StudentRosterRow | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [balances: StudentPassBalance[]]
}>()

const studentDescription = computed(() => {
  if (!props.student) return 'Student redemption history'
  const email = props.student.studentEmail || 'No email'
  const section = props.student.sectionName
    ? props.student.sectionName.toLowerCase().startsWith('section')
      ? props.student.sectionName
      : `Section: ${props.student.sectionName}`
    : 'No section assigned'
  return `${email} • ${section}`
})

const toast = useToast()

const redemptions = ref<StudentRedemptionHistoryRow[]>([])
const loading = ref(false)

// Edit pass balances state
const isEditingBalances = ref(false)
const editableBalances = ref<Record<string, number>>({})
const savingBalances = ref(false)

const startEditingBalances = () => {
  if (!props.student?.passBalances) return
  const map: Record<string, number> = {}
  for (const pb of props.student.passBalances) {
    map[pb.passTypeId] = pb.balance
  }
  editableBalances.value = map
  isEditingBalances.value = true
}

const cancelEditingBalances = () => {
  isEditingBalances.value = false
  editableBalances.value = {}
}

const saveBalances = async () => {
  if (!props.student?.userId) return
  savingBalances.value = true
  try {
    const payload = {
      balances: Object.entries(editableBalances.value).map(([passTypeId, balance]) => ({
        passTypeId,
        balance: Math.max(0, Math.floor(Number(balance) || 0))
      }))
    }

    const res = await $fetch<ApiResponse<StudentPassBalance[]>>(
      `/api/me/students/${props.student.userId}/pass-pools`,
      {
        method: 'PATCH',
        body: payload
      }
    )

    if (res.data) {
      emit('saved', res.data)
      toast.add({
        title: 'Pass balances updated',
        color: 'success'
      })
      isEditingBalances.value = false
    }
  } catch (err: unknown) {
    const error = err as { data?: { message?: string; statusMessage?: string }; message?: string }
    toast.add({
      title: 'Failed to update balances',
      description:
        error.data?.message ||
        error.data?.statusMessage ||
        error.message ||
        'An error occurred while updating pass balances',
      color: 'error'
    })
  } finally {
    savingBalances.value = false
  }
}

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
    isEditingBalances.value = false
    editableBalances.value = {}
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
