<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dashboard.rosterSync.modalTitle')"
    :description="$t('dashboard.rosterSync.modalDescription')"
    :dismissible="false"
    :close="false"
  >
    <template #body>
      <div class="py-6 flex flex-col items-center justify-center text-center space-y-4">
        <div v-if="isSyncing" class="relative flex items-center justify-center">
          <div
            class="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center"
          >
            <UIcon
              name="i-lucide-refresh-cw"
              class="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin"
            />
          </div>
        </div>

        <div v-else class="relative flex items-center justify-center">
          <div
            class="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center"
          >
            <UIcon
              name="i-lucide-check-circle-2"
              class="w-8 h-8 text-green-600 dark:text-green-400"
            />
          </div>
        </div>

        <div class="space-y-1 max-w-sm">
          <h4 class="font-semibold text-gray-900 dark:text-white text-base">
            {{
              isSyncing
                ? $t('dashboard.rosterSync.inProgressTitle')
                : $t('dashboard.rosterSync.completedTitle')
            }}
          </h4>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{
              isSyncing
                ? $t('dashboard.rosterSync.inProgressMessage')
                : $t('dashboard.rosterSync.completedMessage')
            }}
          </p>
        </div>

        <div v-if="isSyncing" class="w-full max-w-xs pt-2">
          <UProgress animation="carousel" color="primary" size="sm" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ApiResponse } from '@@/shared/types/api'

interface RosterSyncStatus {
  isSyncing: boolean
  lastRosterSyncAt: string | null
}

const props = withDefaults(
  defineProps<{
    open?: boolean
  }>(),
  {
    open: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'synced'): void
}>()

const isSyncing = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

const isOpen = computed({
  get: () => props.open,
  set: (val: boolean) => emit('update:open', val)
})

const checkStatus = async () => {
  try {
    const res = await $fetch<ApiResponse<RosterSyncStatus>>('/api/me/course/roster-sync-status')
    if (res?.data) {
      if (!res.data.isSyncing) {
        // Sync has completed
        isSyncing.value = false
        stopPolling()
        emit('synced')

        // Auto-close after brief confirmation
        setTimeout(() => {
          isOpen.value = false
        }, 1000)
      } else {
        isSyncing.value = true
      }
    }
  } catch (err: unknown) {
    const error = err as { statusCode?: number }
    if (error?.statusCode === 401) {
      stopPolling()
      isOpen.value = false
      return
    }
    console.warn('[RosterSyncModal] Status check error:', err)
  }
}

const startPolling = () => {
  stopPolling()
  isSyncing.value = true
  checkStatus()
  pollTimer = setInterval(checkStatus, 1500)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  stopPolling()
})
</script>
