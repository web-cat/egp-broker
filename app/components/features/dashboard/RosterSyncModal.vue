<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dashboard.rosterSync.modalTitle')"
    :description="$t('dashboard.rosterSync.modalDescription')"
    :dismissible="!isSyncing && showDetails"
    :close="!isSyncing && showDetails"
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

        <div v-else-if="showDetails" class="relative flex items-center justify-center">
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

        <!-- Sync Results Breakdown (Teachers only) -->
        <div v-if="!isSyncing && showDetails && syncStatus" class="w-full max-w-md pt-2">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div
              class="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {{ syncStatus.totalStudents }}
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{ $t('dashboard.rosterSync.totalStudentsLabel') }}
              </div>
            </div>

            <div
              class="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {{ syncStatus.totalSections }}
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{ $t('dashboard.rosterSync.totalSectionsLabel') }}
              </div>
            </div>

            <div
              class="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {{ syncStatus.studentsWithSection }}
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{ $t('dashboard.rosterSync.studentsAssignedLabel') }}
              </div>
            </div>
          </div>

          <!-- Diagnostic Alert if 0 sections detected -->
          <div
            v-if="syncStatus.totalSections === 0"
            class="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-left text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2"
          >
            <UIcon
              name="i-lucide-alert-triangle"
              class="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            />
            <span>{{ $t('dashboard.rosterSync.noSectionsWarning') }}</span>
          </div>

          <div class="mt-4 flex justify-center">
            <UButton
              color="primary"
              :label="$t('dashboard.rosterSync.closeButton')"
              @click="closeModal"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ApiResponse } from '@@/shared/types/api'
import type { RosterSyncStatusData } from '@@/shared/models/course'

const props = withDefaults(
  defineProps<{
    open?: boolean
    showDetails?: boolean
  }>(),
  {
    open: false,
    showDetails: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'synced'): void
}>()

const isSyncing = ref(true)
const syncStatus = ref<RosterSyncStatusData | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const isOpen = computed({
  get: () => props.open,
  set: (val: boolean) => emit('update:open', val)
})

const closeModal = () => {
  isOpen.value = false
}

const checkStatus = async () => {
  try {
    const res = await $fetch<ApiResponse<RosterSyncStatusData>>('/api/me/course/roster-sync-status')
    if (res?.data) {
      if (!res.data.isSyncing) {
        // Sync has completed
        isSyncing.value = false
        stopPolling()
        emit('synced')

        if (props.showDetails) {
          syncStatus.value = res.data
        } else {
          closeModal()
        }
      } else {
        isSyncing.value = true
      }
    }
  } catch (err: unknown) {
    const error = err as { statusCode?: number }
    if (error?.statusCode === 401) {
      stopPolling()
      closeModal()
      return
    }
    console.warn('[RosterSyncModal] Status check error:', err)
  }
}

const startPolling = () => {
  stopPolling()
  isSyncing.value = true
  syncStatus.value = null
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
