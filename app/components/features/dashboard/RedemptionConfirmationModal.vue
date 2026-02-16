<script setup lang="ts">
import { formatDate } from '~/utils/date'

const props = defineProps<{
  open: boolean
  assignment: any
  passType: { id: string; name: string }
  hoursPerPass: number
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const newDueDate = computed(() => {
  if (!props.assignment?.dueDate) return null
  const date = new Date(props.assignment.dueDate)
  return new Date(date.getTime() + props.hoursPerPass * 60 * 60 * 1000)
})

const newAcceptUntil = computed(() => {
  const base = props.assignment?.acceptUntil || props.assignment?.dueDate
  if (!base) return null
  const date = new Date(base)
  return new Date(date.getTime() + props.hoursPerPass * 60 * 60 * 1000)
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="`Redeem ${passType.name}`"
    :description="`Confirm pass usage for ${assignment.title}`"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Are you sure you want to redeem a <strong>{{ passType.name }}</strong> for <strong>{{ assignment.title }}</strong>? This will deduct 1 pass from your balance.
        </p>

        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">Pass Duration</span>
            <span class="font-medium text-gray-900 dark:text-white font-mono">+{{ hoursPerPass }}h</span>
          </div>

          <div class="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div class="flex justify-between items-start text-sm">
              <span class="text-gray-500">Current Due Date</span>
              <span class="text-right text-gray-900 dark:text-white">
                {{ formatDate(assignment.dueDate) || '—' }}
              </span>
            </div>
          </div>

          <div class="pt-1">
            <div class="flex justify-between items-start text-sm">
              <span class="text-primary-600 dark:text-primary-400 font-semibold">New Due Date</span>
              <span class="text-right text-primary-600 dark:text-primary-400 font-bold">
                {{ formatDate(newDueDate) || '—' }}
              </span>
            </div>
          </div>

          <div v-if="newAcceptUntil" class="pt-1">
            <div class="flex justify-between items-start text-xs text-gray-500 italic">
              <span>Extension Cutoff</span>
              <span>{{ formatDate(newAcceptUntil) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="isOpen = false"
        />
        <UButton
          color="primary"
          :loading="loading"
          label="Confirm Redemption"
          icon="i-lucide-check"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
