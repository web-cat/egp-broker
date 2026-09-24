<template>
  <div class="space-y-4">
    <!-- Filter Bar Card -->
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Student Name or Email Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Student</label>
          <UInput
            v-model="studentFilter"
            icon="i-lucide-search"
            placeholder="Name, email, or ID…"
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Assignment Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Assignment</label>
          <UInput
            v-model="assignmentFilter"
            icon="i-lucide-file-text"
            placeholder="Assignment title…"
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Course Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Course</label>
          <UInput
            v-model="courseFilter"
            icon="i-lucide-book-open"
            placeholder="Course code or name…"
            class="w-full"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Date Range: From -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Date From</label>
          <UInput
            v-model="dateFrom"
            type="date"
            class="w-full"
            @change="handleSearch"
          />
        </div>

        <!-- Date Range: To -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Date To</label>
          <UInput
            v-model="dateTo"
            type="date"
            class="w-full"
            @change="handleSearch"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs">
        <p class="text-neutral-500">
          Showing observation notes recorded by proctors in reverse chronological order.
        </p>

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
            @click="handleSearch"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-refresh-cw"
            label="Refresh"
            :loading="loading"
            @click="fetchNotes"
          />
        </div>
      </div>
    </UCard>

    <!-- Notes Table -->
    <UCard :ui="{ body: 'p-0' }">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!notes || notes.length === 0"
        class="text-center py-16 text-neutral-500"
      >
        <UIcon name="i-lucide-clipboard-check" class="w-12 h-12 mx-auto mb-2 text-neutral-400" />
        <p class="text-base font-medium text-neutral-900 dark:text-neutral-100">
          No observation notes found
        </p>
        <p class="text-sm mt-1">
          Try adjusting your search criteria or date range.
        </p>
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            <tr>
              <th scope="col" class="px-4 py-3">Logged At</th>
              <th scope="col" class="px-4 py-3">Student</th>
              <th scope="col" class="px-4 py-3">Course & Assignment</th>
              <th scope="col" class="px-4 py-3">Reservation</th>
              <th scope="col" class="px-4 py-3 min-w-[280px]">Note</th>
              <th scope="col" class="px-4 py-3">Proctor</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
            <tr
              v-for="note in notes"
              :key="note.id"
              class="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition-colors"
            >
              <!-- Logged At -->
              <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap align-top">
                <div class="font-medium text-neutral-900 dark:text-neutral-100">
                  {{ formatDateTime(note.createdAt) }}
                </div>
              </td>

              <!-- Student -->
              <td class="px-4 py-3 align-top">
                <div class="flex flex-col">
                  <span class="font-semibold text-neutral-900 dark:text-neutral-100">
                    {{ note.reservation?.student?.name || '—' }}
                  </span>
                  <span v-if="note.reservation?.student?.email" class="text-xs text-neutral-500">
                    {{ note.reservation.student.email }}
                  </span>
                  <span v-if="note.reservation?.student?.studentId" class="text-xs text-neutral-400 font-mono">
                    ID: {{ note.reservation.student.studentId }}
                  </span>
                </div>
              </td>

              <!-- Course & Assignment -->
              <td class="px-4 py-3 align-top">
                <div class="flex flex-col">
                  <span class="font-medium text-neutral-900 dark:text-neutral-100">
                    {{ note.reservation?.assignment?.title || '—' }}
                  </span>
                  <span v-if="note.reservation?.course?.label || note.reservation?.course?.title" class="text-xs text-neutral-500">
                    {{ note.reservation?.course?.label || note.reservation?.course?.title }}
                  </span>
                </div>
              </td>

              <!-- Reservation Details -->
              <td class="px-4 py-3 align-top whitespace-nowrap">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1.5">
                    <UBadge variant="subtle" color="primary" size="xs" class="font-mono font-bold">
                      Seat #{{ note.reservation?.seatNumber }}
                    </UBadge>
                    <UBadge
                      v-if="note.reservation?.status"
                      :color="statusBadgeColor(note.reservation.status)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ note.reservation.status }}
                    </UBadge>
                  </div>
                  <span class="text-xs text-neutral-500">
                    Start: {{ formatDateTime(note.reservation?.startTime) }}
                  </span>
                </div>
              </td>

              <!-- Note Content & Photos -->
              <td class="px-4 py-3 align-top">
                <div class="space-y-1.5">
                  <p class="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
                    {{ note.content }}
                  </p>
                  <div v-if="note.hasPhotos">
                    <UBadge color="warning" variant="subtle" size="xs" class="gap-1 inline-flex items-center">
                      <UIcon name="i-lucide-camera" class="w-3 h-3" />
                      <span>Photos Captured</span>
                    </UBadge>
                  </div>
                </div>
              </td>

              <!-- Proctor / Author -->
              <td class="px-4 py-3 align-top whitespace-nowrap">
                <div class="flex flex-col">
                  <span class="font-medium text-neutral-900 dark:text-neutral-100">
                    {{ note.author?.name || '—' }}
                  </span>
                  <span v-if="note.author?.email" class="text-xs text-neutral-500">
                    {{ note.author.email }}
                  </span>
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
            of <span class="font-semibold">{{ pagination.total }}</span> notes
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
import { onMounted } from 'vue'
import { useAdminCbtfNotes } from '~/composables/features/admin/useAdminCbtfNotes'

const {
  studentFilter,
  assignmentFilter,
  courseFilter,
  dateFrom,
  dateTo,
  page,
  pageSize,
  notes,
  pagination,
  loading,
  fetchNotes,
  resetFilters
} = useAdminCbtfNotes()

onMounted(() => {
  fetchNotes()
})

const handleSearch = () => {
  page.value = 1
  fetchNotes()
}

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
</script>
