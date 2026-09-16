<template>
  <div class="space-y-4">
    <!-- Filter Bar Card -->
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Search by Student Name or Email -->
        <div class="lg:col-span-2">
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Search Student</label>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search by student name, email, or ID…"
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Status</label>
          <USelect
            v-model="status"
            :items="statusFilterOptions"
            class="w-full"
            @update:model-value="onFilterChange"
          />
        </div>

        <!-- Start Date From -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Start Date From</label>
          <UInput
            v-model="startDateFrom"
            type="datetime-local"
            class="w-full"
            @change="onFilterChange"
          />
        </div>

        <!-- Start Date To -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Start Date To</label>
          <UInput
            v-model="startDateTo"
            type="datetime-local"
            class="w-full"
            @change="onFilterChange"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer select-none text-neutral-700 dark:text-neutral-300">
            <input
              v-model="upcomingOnly"
              type="checkbox"
              class="rounded text-primary-600 focus:ring-primary-500"
              @change="onUpcomingToggle"
            />
            <span>Upcoming Reservations Only (from current time)</span>
          </label>

          <UBadge v-if="upcomingOnly" color="primary" variant="subtle" size="xs">
            Showing Next Upcoming
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-rotate-ccw"
            label="Reset"
            @click="resetFilters"
          />
          <UButton
            size="xs"
            color="primary"
            icon="i-lucide-filter"
            label="Apply Filters"
            @click="fetchReservations"
          />
        </div>
      </div>
    </UCard>

    <!-- Reservations Table -->
    <UCard :ui="{ body: 'p-0' }">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!reservations || reservations.length === 0"
        class="text-center py-16 text-neutral-500"
      >
        <UIcon name="i-lucide-calendar-x-2" class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p class="font-medium text-base">No reservations found</p>
        <p class="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
          No records match your active search or date filters. Try broadening the date range or clearing filters.
        </p>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          label="Clear Filters"
          class="mt-4"
          @click="resetFilters"
        />
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Assignment</th>
              <th class="px-4 py-3 text-center">Seat</th>
              <th class="px-4 py-3">Start Time</th>
              <th class="px-4 py-3">End Time</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Canvas Sync</th>
              <th v-if="!readOnly || showResyncCanvas" class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
            <tr
              v-for="res in reservations"
              :key="res.id"
              class="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition-colors"
            >
              <!-- Student -->
              <td class="px-4 py-3">
                <div class="flex flex-col">
                  <span class="font-semibold text-neutral-900 dark:text-neutral-100">
                    {{ res.studentName || '—' }}
                  </span>
                  <span v-if="res.studentEmail" class="text-xs text-neutral-500">
                    {{ res.studentEmail }}
                  </span>
                  <span v-if="res.studentId" class="text-xs text-neutral-400 font-mono">
                    ID: {{ res.studentId }}
                  </span>
                </div>
              </td>

              <!-- Assignment -->
              <td class="px-4 py-3">
                <span class="font-medium text-neutral-800 dark:text-neutral-200">
                  {{ res.assignmentTitle || '—' }}
                </span>
              </td>

              <!-- Seat -->
              <td class="px-4 py-3 text-center">
                <UBadge variant="subtle" color="primary" class="font-mono font-bold">
                  #{{ res.seatNumber }}
                </UBadge>
              </td>

              <!-- Start Time -->
              <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                {{ formatDateTime(res.startTime) }}
              </td>

              <!-- End Time -->
              <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                {{ formatDateTime(res.endTime) }}
              </td>

              <!-- Status -->
              <td class="px-4 py-3">
                <UBadge :color="statusBadgeColor(res.status)" variant="subtle" size="xs">
                  {{ res.status }}
                </UBadge>
              </td>

              <!-- Canvas Sync -->
              <td class="px-4 py-3">
                <div v-if="res.canvasOverrideId" class="flex items-center gap-1.5 text-xs text-success-600 dark:text-success-400 font-medium">
                  <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 shrink-0" />
                  <span class="font-mono">#{{ res.canvasOverrideId }}</span>
                </div>
                <div v-else class="text-xs text-neutral-400 italic">
                  Not synced
                </div>
              </td>

              <!-- Actions -->
              <td v-if="!readOnly || showResyncCanvas" class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <!-- Canvas Resync Action -->
                  <UButton
                    v-if="showResyncCanvas"
                    icon="i-lucide-refresh-cw"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :loading="resyncingId === res.id"
                    title="Resync Canvas Override"
                    aria-label="Resync Canvas Override"
                    @click="handleResync(res)"
                  />

                  <!-- Admin Edit Action -->
                  <UButton
                    v-if="!readOnly"
                    icon="i-lucide-pencil"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    aria-label="Edit reservation"
                    @click="$emit('edit', res)"
                  />

                  <!-- Admin Delete Action -->
                  <UButton
                    v-if="!readOnly"
                    icon="i-lucide-trash-2"
                    variant="ghost"
                    color="error"
                    size="xs"
                    aria-label="Delete reservation"
                    @click="$emit('delete', res)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <template v-if="pagination.total > 0" #footer>
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2">
          <p class="text-xs text-neutral-500">
            Showing <span class="font-semibold">{{ (pagination.page - 1) * pagination.pageSize + 1 }}</span>
            to <span class="font-semibold">{{ Math.min(pagination.page * pagination.pageSize, pagination.total) }}</span>
            of <span class="font-semibold">{{ pagination.total }}</span> reservations
          </p>

          <UPagination
            v-model:page="page"
            :items-per-page="pageSize"
            :total="pagination.total"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminCbtfReservations } from '~/composables/features/admin/useAdminCbtfReservations'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
    showResyncCanvas?: boolean
    endpoint?: string
    isTraining?: boolean
  }>(),
  {
    readOnly: false,
    showResyncCanvas: true,
    endpoint: '/api/proctor/reservations',
    isTraining: false
  }
)

defineEmits<{
  (e: 'edit' | 'delete', reservation: CbtfReservationDto): void
}>()

const toast = useToast()
const resyncingId = ref<string | null>(null)

const {
  search,
  status,
  startDateFrom,
  startDateTo,
  upcomingOnly,
  page,
  pageSize,
  reservations,
  pagination,
  loading,
  fetchReservations,
  resyncCanvas,
  resetFilters
} = useAdminCbtfReservations({
  endpoint: props.endpoint
})

const statusFilterOptions = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Missed', value: 'MISSED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]

const statusBadgeColor = (st: string) => {
  switch (st) {
    case 'SCHEDULED':
      return 'primary'
    case 'CHECKED_IN':
      return 'success'
    case 'CHECKED_OUT':
      return 'neutral'
    case 'MISSED':
      return 'warning'
    case 'CANCELLED':
      return 'error'
    default:
      return 'neutral'
  }
}

const formatDateTime = (isoString: string | Date | null | undefined) => {
  if (!isoString) return '—'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const handleSearch = () => {
  page.value = 1
  fetchReservations()
}

const onFilterChange = () => {
  page.value = 1
  fetchReservations()
}

const onUpcomingToggle = () => {
  if (upcomingOnly.value) {
    startDateFrom.value = ''
    startDateTo.value = ''
  }
  page.value = 1
  fetchReservations()
}

const handleResync = async (res: CbtfReservationDto) => {
  resyncingId.value = res.id

  if (props.isTraining) {
    // In-memory simulation for training sandbox
    setTimeout(() => {
      if (res.status === 'CANCELLED') {
        res.canvasOverrideId = null
        toast.add({
          title: 'Reservation Cancelled',
          description: 'Reservation is cancelled; Canvas override was removed in training sandbox.',
          color: 'info'
        })
      } else {
        res.canvasOverrideId = 'cov-sim-' + Math.floor(Math.random() * 9000 + 1000)
        toast.add({
          title: 'Canvas Override Synced',
          description: `Simulated Canvas assignment override updated (#${res.canvasOverrideId}).`,
          color: 'success'
        })
      }
      resyncingId.value = null
    }, 400)
    return
  }

  try {
    await resyncCanvas(res.id)
  } finally {
    resyncingId.value = null
  }
}

onMounted(() => {
  fetchReservations()
})

defineExpose({
  fetchReservations,
  resetFilters,
  reservations,
  pagination
})
</script>
