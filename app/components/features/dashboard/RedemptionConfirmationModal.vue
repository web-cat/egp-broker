<script setup lang="ts">
import { formatDate } from '~/utils/date'
import { calculatePassExtension } from '@@/shared/utils/extension'

const props = defineProps<{
  open: boolean
  assignment: any
  passType: {
    id: string
    name: string
    hoursPerPass?: number
    extensionOnly?: boolean
    minDaysPastDue?: number | null
    maxDaysPastDue?: number | null
  }
  hoursPerPass: number
  latestRedemption?: any
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

const extensionResult = computed(() => {
  if (!props.assignment || !props.passType) return null
  return calculatePassExtension({
    assignment: props.assignment,
    passType: {
      extensionOnly: props.passType.extensionOnly ?? false,
      hoursPerPass: props.hoursPerPass || 24,
      minDaysPastDue: props.passType.minDaysPastDue,
      maxDaysPastDue: props.passType.maxDaysPastDue
    },
    latestRedemption: props.latestRedemption,
    now: new Date()
  })
})

const isEligible = computed(() => extensionResult.value?.isEligible ?? true)
const ineligibilityReason = computed(() => extensionResult.value?.reason ?? '')
const requiredCost = computed(() => extensionResult.value?.cost ?? 1)
const newDueDate = computed(() => extensionResult.value?.newDueDate ?? null)
const newAcceptUntil = computed(() => extensionResult.value?.newAcceptUntil ?? null)
const isClipped = computed(() => extensionResult.value?.isClipped ?? false)

const hasSufficientBalance = computed(() => {
  if (props.passType?.balance === undefined) return true
  return props.passType.balance >= requiredCost.value
})

const currentEffectiveDueDate = computed(() => {
  if (props.latestRedemption?.dueDate) return props.latestRedemption.dueDate
  return props.assignment?.dueDate
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
          Are you sure you want to redeem a <strong>{{ passType.name }}</strong> for
          <strong>{{ assignment.title }}</strong
          >? This will deduct
          <strong>{{ requiredCost }} {{ requiredCost === 1 ? 'pass' : 'passes' }}</strong> from your
          balance.
        </p>

        <div
          v-if="!isEligible"
          class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800"
        >
          {{ ineligibilityReason }}
        </div>

        <div
          v-else-if="!hasSufficientBalance"
          class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800"
        >
          Insufficient pass balance. You have {{ passType.balance }}
          {{ passType.balance === 1 ? 'pass' : 'passes' }}, but {{ requiredCost }}
          {{ requiredCost === 1 ? 'pass is' : 'passes are' }} required to extend past the current
          time.
        </div>

        <div
          v-if="isClipped"
          class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800"
        >
          Note: The extension is capped by the maximum allowed days limit for this assignment.
        </div>

        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">Pass Duration</span>
            <span class="font-medium text-gray-900 dark:text-white font-mono"
              >+{{ hoursPerPass }}h</span
            >
          </div>

          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-500">Pass Cost</span>
            <span class="font-semibold text-gray-900 dark:text-white font-mono"
              >{{ requiredCost }} {{ requiredCost === 1 ? 'pass' : 'passes' }}</span
            >
          </div>

          <div class="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div class="flex justify-between items-start text-sm">
              <span class="text-gray-500">Current Due Date</span>
              <span class="text-right text-gray-900 dark:text-white">
                {{ formatDate(currentEffectiveDueDate) || '—' }}
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
        <UButton color="neutral" variant="ghost" label="Cancel" @click="isOpen = false" />
        <UButton
          color="primary"
          :loading="loading"
          :disabled="!isEligible || !hasSufficientBalance"
          label="Confirm Redemption"
          icon="i-lucide-check"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
