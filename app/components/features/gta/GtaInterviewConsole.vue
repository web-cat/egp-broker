<template>
  <div class="space-y-6">
    <!-- Training Sandbox Mode Banner -->
    <div
      v-if="isTraining"
      data-testid="training-banner"
      class="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm space-y-3"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="p-2 rounded-lg bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
          >
            <UIcon name="i-lucide-graduation-cap" class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold">GRADUATE TA TRAINING SANDBOX</h2>
              <UBadge color="warning" variant="solid" size="xs"> In-Memory Mode </UBadge>
            </div>
            <p class="text-xs opacity-85">
              Practice student check-ins, active interview observation notes, checkouts, and no-shows. Zero database writes.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            data-testid="reset-scenario-btn"
            variant="outline"
            color="warning"
            size="xs"
            icon="i-lucide-rotate-ccw"
            label="Reset Scenario"
            @click="handleResetScenario"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-log-out"
            label="Exit Training"
            to="/interviews"
          />
        </div>
      </div>
    </div>

    <!-- Header / Context Bar -->
    <div
      class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-arrow-left"
            :to="isTraining ? '/interviews' : '/'"
          />
          <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <UIcon name="i-lucide-user-check" class="w-6 h-6 text-primary-500" />
            Graduate TA Interview Console
            <UBadge v-if="isTraining" color="warning" variant="subtle" size="xs">
              TRAINING
            </UBadge>
          </h1>
        </div>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ courseCode ? `${courseCode}: ${courseTitle || ''}` : courseTitle || 'Course Grading Interviews' }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Location Badge -->
        <div
          v-if="effectiveLocation"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-300"
        >
          <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span class="truncate max-w-[220px]">
            Location: <strong>{{ effectiveLocation }}</strong>
          </span>
        </div>

        <UButton
          v-if="!isTraining"
          icon="i-lucide-graduation-cap"
          variant="outline"
          color="warning"
          size="sm"
          label="Training Mode"
          to="/interviews/training"
        />

        <UButton
          icon="i-lucide-refresh-cw"
          variant="outline"
          color="neutral"
          size="sm"
          :loading="feedStatus === 'pending'"
          @click="() => refreshFeed()"
        />
      </div>
    </div>

    <!-- Filter Bar Card (Date, Shift, GTA, Status) -->
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Date Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Date</label>
          <UInput
            v-model="filterDate"
            type="date"
            class="w-full"
            aria-label="Filter by date"
          />
        </div>

        <!-- Shift Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Shift</label>
          <USelect
            v-model="filterShift"
            :items="shiftFilterOptions"
            class="w-full"
            aria-label="Filter by shift"
          />
        </div>

        <!-- GTA Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Teaching Assistant</label>
          <USelect
            v-model="filterGta"
            :items="gtaFilterOptions"
            class="w-full"
            aria-label="Filter by teaching assistant"
          />
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-xs font-semibold text-neutral-500 mb-1">Status</label>
          <USelect
            v-model="filterStatus"
            :items="statusFilterOptions"
            class="w-full"
            aria-label="Filter by status"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs">
        <div class="flex items-center gap-2 text-neutral-500">
          <span v-if="activeFilterCount > 0" class="flex items-center gap-1.5 font-medium text-primary-600 dark:text-primary-400">
            <UIcon name="i-lucide-filter" class="w-3.5 h-3.5" />
            {{ activeFilterCount }} active filter{{ activeFilterCount === 1 ? '' : 's' }}
          </span>
          <span v-else>All appointments shown (no filters applied)</span>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-rotate-ccw"
            label="Reset Filters"
            :disabled="activeFilterCount === 0"
            @click="resetFilters"
          />
        </div>
      </div>
    </UCard>

    <!-- Active In-Progress Interview Hero Panel -->
    <div
      v-if="activeInterview"
      class="p-6 rounded-2xl border-2 border-primary-500/40 bg-gradient-to-br from-primary-50/60 via-white to-neutral-50 dark:from-primary-950/20 dark:via-neutral-900 dark:to-neutral-900 shadow-md space-y-5"
    >
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Active Interview In Progress
          </span>
        </div>
        <UBadge color="primary" variant="subtle" size="md">
          Checked In at {{ formatTimeOnly(activeInterview.checkedInAt || activeInterview.startTime) }}
        </UBadge>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Student & Assignment Details -->
        <div class="space-y-4 lg:border-r border-neutral-200 dark:border-neutral-800 lg:pr-6">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg"
            >
              {{ activeInterview.student?.firstName?.[0] || 'S' }}
            </div>
            <div class="min-w-0">
              <p class="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {{ formatStudentName(activeInterview.student) }}
              </p>
              <p class="text-xs text-neutral-500 truncate">
                {{ activeInterview.student?.email }}
              </p>
            </div>
          </div>

          <div class="space-y-1 pt-2">
            <span class="text-xs text-neutral-500 uppercase font-medium">Assignment</span>
            <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {{ activeInterview.assignment?.title || 'Grading Interview' }}
            </p>
          </div>

          <div class="space-y-1">
            <span class="text-xs text-neutral-500 uppercase font-medium">Scheduled Slot</span>
            <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {{ formatSlotRange(activeInterview.startTime, activeInterview.endTime) }}
            </p>
          </div>
        </div>

        <!-- Notes & Checkout Console -->
        <div class="lg:col-span-2 space-y-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                Grading & Observation Notes
              </label>
              <span class="text-xs text-neutral-400">
                Visible to student upon pass redemption
              </span>
            </div>
            <UTextarea
              v-model="notesDraft"
              placeholder="Record notes on student code walkthrough, question responses, or conceptual understanding…"
              :rows="4"
              class="w-full"
            />
          </div>

          <div class="flex items-center justify-between flex-wrap gap-3 pt-2">
            <div class="flex items-center gap-2">
              <UButton
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-save"
                label="Save Notes"
                :loading="isUpdating"
                @click="handleSaveNotes"
              />
              <UButton
                variant="ghost"
                color="warning"
                size="sm"
                icon="i-lucide-undo-2"
                label="Cancel Check-In"
                :disabled="isUpdating"
                @click="confirmCancelCheckIn"
              />
            </div>
            <UButton
              color="primary"
              size="md"
              icon="i-lucide-check-circle-2"
              label="Complete & Check Out"
              :loading="isUpdating"
              @click="handleCheckOut"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Expected Arrivals Queue -->
    <div class="space-y-4">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UIcon name="i-lucide-clock" class="w-5 h-5 text-neutral-500" />
          Expected Arrivals
          <UBadge
            v-if="filteredExpectedArrivals.length > 0"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ filteredExpectedArrivals.length }}
          </UBadge>
        </h3>
      </div>

      <div
        v-if="filteredExpectedArrivals.length === 0"
        class="p-8 text-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30"
      >
        <UIcon name="i-lucide-calendar-check" class="w-8 h-8 mx-auto text-neutral-400 mb-2" />
        <p class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {{ activeFilterCount > 0 ? 'No upcoming arrivals match your active filters.' : 'No upcoming arrivals scheduled for your shift today.' }}
        </p>
        <UButton
          v-if="activeFilterCount > 0"
          size="xs"
          variant="outline"
          color="neutral"
          label="Clear Filters"
          class="mt-3"
          @click="resetFilters"
        />
      </div>

      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="reservation in paginatedExpectedArrivals"
            :key="reservation.id"
            class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1 min-w-0">
                <span class="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
                  <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                  {{ formatSlotRange(reservation.startTime, reservation.endTime) }}
                </span>
                <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {{ formatStudentName(reservation.student) }}
                </p>
                <p class="text-xs text-neutral-500 truncate">
                  {{ reservation.student?.email }}
                </p>
                <p v-if="isInstructorOrAdmin && (reservation.gta || reservation.gtaId)" class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  GTA: {{ reservation.gta ? `${reservation.gta.firstName} ${reservation.gta.lastName}` : reservation.gtaId }}
                </p>
              </div>
              <UBadge color="neutral" variant="outline" size="xs">
                {{ reservation.assignment?.title || 'Assignment' }}
              </UBadge>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                label="No-Show"
                icon="i-lucide-user-x"
                :disabled="isUpdating"
                @click="confirmNoShow(reservation)"
              />
              <UButton
                color="primary"
                variant="solid"
                size="xs"
                label="Check In"
                icon="i-lucide-user-check"
                :disabled="activeInterview !== null || isUpdating"
                :title="activeInterview ? 'Complete currently active interview first' : 'Start 1-on-1 interview'"
                @click="handleCheckIn(reservation.id)"
              />
            </div>
          </div>
        </div>

        <!-- Pagination for Expected Arrivals -->
        <div
          v-if="filteredExpectedArrivals.length > expectedPageSize"
          class="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
        >
          <p class="text-neutral-500">
            Showing <span class="font-semibold">{{ (expectedPage - 1) * expectedPageSize + 1 }}</span>
            to <span class="font-semibold">{{ Math.min(expectedPage * expectedPageSize, filteredExpectedArrivals.length) }}</span>
            of <span class="font-semibold">{{ filteredExpectedArrivals.length }}</span> expected arrivals
          </p>
          <UPagination
            v-model:page="expectedPage"
            :items-per-page="expectedPageSize"
            :total="filteredExpectedArrivals.length"
          />
        </div>
      </div>
    </div>

    <!-- Completed & Past Shift Appointments -->
    <div class="space-y-4 pt-4">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UIcon name="i-lucide-history" class="w-5 h-5 text-neutral-500" />
          Completed Interviews
          <UBadge
            v-if="filteredCompletedList.length > 0"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ filteredCompletedList.length }}
          </UBadge>
        </h3>
      </div>

      <div
        v-if="filteredCompletedList.length === 0"
        class="p-8 text-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30"
      >
        <UIcon name="i-lucide-clipboard-check" class="w-8 h-8 mx-auto text-neutral-400 mb-2" />
        <p class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {{ activeFilterCount > 0 ? 'No completed interviews match your active filters.' : 'No completed, cancelled, or missed appointments recorded yet.' }}
        </p>
        <UButton
          v-if="activeFilterCount > 0"
          size="xs"
          variant="outline"
          color="neutral"
          label="Clear Filters"
          class="mt-3"
          @click="resetFilters"
        />
      </div>

      <div v-else class="space-y-4">
        <div class="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table class="w-full text-left text-xs">
            <thead class="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 uppercase font-semibold border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th class="px-4 py-3">Student</th>
                <th class="px-4 py-3">Assignment</th>
                <th class="px-4 py-3">Time</th>
                <th v-if="isInstructorOrAdmin" class="px-4 py-3">GTA</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Notes</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
              <tr v-for="res in paginatedCompletedList" :key="res.id">
                <td class="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                  {{ formatStudentName(res.student) }}
                  <span class="block text-neutral-400 font-normal">{{ res.student?.email }}</span>
                </td>
                <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {{ res.assignment?.title || '—' }}
                </td>
                <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {{ formatSlotRange(res.startTime, res.endTime) }}
                </td>
                <td v-if="isInstructorOrAdmin" class="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {{ res.gta ? `${res.gta.firstName} ${res.gta.lastName}` : (res.gtaId || '—') }}
                </td>
                <td class="px-4 py-3">
                  <UBadge :color="statusColor(res.status)" variant="subtle" size="xs">
                    {{ res.status }}
                  </UBadge>
                </td>
                <!-- Full content wrapped text instead of truncating -->
                <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 min-w-[200px] max-w-md whitespace-pre-wrap break-words">
                  {{ res.notes || '—' }}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1.5">
                    <UButton
                      v-if="canEditInterview(res)"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-pencil"
                      label="Edit"
                      title="Edit observation notes and status"
                      :disabled="isUpdating"
                      @click="openEditNotesModal(res)"
                    />
                    <UButton
                      v-if="res.status === 'MISSED'"
                      color="warning"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-rotate-ccw"
                      label="Reinstate"
                      title="Return student to Expected Arrivals queue"
                      :disabled="isUpdating"
                      @click="handleReinstate(res.id)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination for Completed Interviews -->
        <div
          v-if="filteredCompletedList.length > completedPageSize"
          class="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
        >
          <p class="text-neutral-500">
            Showing <span class="font-semibold">{{ (completedPage - 1) * completedPageSize + 1 }}</span>
            to <span class="font-semibold">{{ Math.min(completedPage * completedPageSize, filteredCompletedList.length) }}</span>
            of <span class="font-semibold">{{ filteredCompletedList.length }}</span> completed interviews
          </p>
          <UPagination
            v-model:page="completedPage"
            :items-per-page="completedPageSize"
            :total="filteredCompletedList.length"
          />
        </div>
      </div>
    </div>

    <!-- Cancel Check-In Confirmation Modal -->
    <UModal
      v-model:open="showCancelCheckInModal"
      title="Cancel Check-In"
      description="Revert to scheduled status"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-neutral-600 dark:text-neutral-300">
            Are you sure you want to cancel the check-in for
            <strong>{{ formatStudentName(activeInterview?.student) }}</strong>?
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg">
            The student will be returned to Expected Arrivals and the active session will be cleared so you can check in the correct student.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Keep Checked In"
            @click="showCancelCheckInModal = false"
          />
          <UButton
            color="warning"
            label="Yes, Cancel Check-In"
            :loading="isUpdating"
            @click="executeCancelCheckIn"
          />
        </div>
      </template>
    </UModal>

    <!-- Edit Completed Interview Modal -->
    <UModal
      v-model:open="showEditNotesModal"
      title="Edit Interview"
      description="Update observation notes and status"
    >
      <template #body>
        <div class="space-y-4">
          <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1">
            <div><strong>Student:</strong> {{ formatStudentName(targetEditNotes?.student) }} ({{ targetEditNotes?.student?.email }})</div>
            <div><strong>Assignment:</strong> {{ targetEditNotes?.assignment?.title || 'Assignment' }}</div>
            <div><strong>Time:</strong> {{ targetEditNotes ? formatSlotRange(targetEditNotes.startTime, targetEditNotes.endTime) : '' }}</div>
            <div v-if="targetEditNotes?.gta"><strong>Assigned GTA:</strong> {{ targetEditNotes.gta.firstName }} {{ targetEditNotes.gta.lastName }}</div>
          </div>

          <!-- Status Dropdown -->
          <div>
            <label class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Status
            </label>
            <USelect
              v-model="editStatusDraft"
              :items="editStatusOptions"
              class="w-full"
              aria-label="Edit appointment status"
            />
          </div>

          <!-- Observation / Grading Notes Textarea -->
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Observation & Grading Notes
            </label>
            <UTextarea
              v-model="editNotesDraft"
              placeholder="Observation and grading notes..."
              :rows="4"
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="showEditNotesModal = false"
          />
          <UButton
            color="primary"
            label="Save Changes"
            :loading="isUpdating"
            @click="executeSaveEditNotes"
          />
        </div>
      </template>
    </UModal>

    <!-- No-Show Confirmation Modal -->
    <UModal v-model:open="showNoShowModal" title="Mark Student as No-Show" description="Confirm absent status">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-neutral-600 dark:text-neutral-300">
            Are you sure you want to mark <strong>{{ formatStudentName(targetNoShow?.student) }}</strong> as a No-Show for this appointment?
          </p>
          <p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20">
            The appointment will be flagged as MISSED, immediately freeing the student to schedule another slot within the assignment window.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="showNoShowModal = false"
          />
          <UButton
            color="error"
            label="Confirm No-Show"
            :loading="isUpdating"
            @click="executeNoShow"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGtaInterviewConsole } from '~/composables/features/useGtaInterviewConsole'
import type { ApiResponse } from '@@/shared/types/api'

const props = withDefaults(
  defineProps<{
    courseId: string
    courseTitle?: string | null
    courseCode?: string | null
    interviewLocation?: string | null
    isInstructor?: boolean
    isTraining?: boolean
    trainingState?: any
  }>(),
  {
    courseTitle: null,
    courseCode: null,
    interviewLocation: null,
    isInstructor: false,
    isTraining: false,
    trainingState: undefined
  }
)

const effectiveLocation = computed(() => props.interviewLocation || '')

const consoleState =
  props.isTraining && props.trainingState
    ? props.trainingState
    : useGtaInterviewConsole(computed(() => props.courseId))

const {
  activeInterview,
  expectedArrivals,
  completedList,
  feedStatus,
  isUpdating,
  refreshFeed,
  checkIn,
  cancelCheckIn,
  checkOut,
  updateInterview,
  saveNotes,
  markNoShow,
  reinstateReservation
} = consoleState

const { user } = useUserSession()

const isInstructorOrAdmin = computed(() => {
  if (props.isTraining) return true
  if (user.value?.globalRole === 'ADMIN') return true
  return Boolean(props.isInstructor)
})

const canEditInterview = (res: any) => {
  if (isInstructorOrAdmin.value) return true
  const curId = user.value?.id
  if (!curId) return false
  return Boolean((res.gtaId && res.gtaId === curId) || (res.gta?.id && res.gta?.id === curId))
}

// Filter States
const filterDate = ref('')
const filterShift = ref('ALL')
const filterGta = ref('ALL')
const filterStatus = ref('ALL')

// Pagination States
const expectedPage = ref(1)
const expectedPageSize = 25
const completedPage = ref(1)
const completedPageSize = 25

// Filter Options
const shiftFilterOptions = [
  { label: 'All Shifts', value: 'ALL' },
  { label: 'Morning (< 12:30 PM)', value: 'MORNING' },
  { label: 'Afternoon / Evening (12:30 PM+)', value: 'AFTERNOON' }
]

const statusFilterOptions = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Missed (No-Show)', value: 'MISSED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Scheduled', value: 'SCHEDULED' }
]

const { data: courseGtasData } = useFetch<ApiResponse<any[]>>(
  computed(() =>
    !props.isTraining && props.courseId ? `/api/me/courses/${props.courseId}/gtas` : null
  ),
  { lazy: true }
)

const gtaFilterOptions = computed(() => {
  const opts = [{ label: 'All GTAs', value: 'ALL' }]
  const map = new Map<string, string>()

  if (courseGtasData.value?.data) {
    for (const g of courseGtasData.value.data) {
      map.set(g.id, `${g.firstName} ${g.lastName}`.trim())
    }
  }

  const allRes = [
    ...(consoleState.reservations?.value || []),
    ...(expectedArrivals.value || []),
    ...(completedList.value || [])
  ]
  for (const r of allRes) {
    if (r.gta && r.gta.id) {
      map.set(r.gta.id, `${r.gta.firstName} ${r.gta.lastName}`.trim())
    } else if (r.gtaId) {
      map.set(r.gtaId, `GTA (${r.gtaId})`)
    }
  }

  for (const [id, name] of map.entries()) {
    opts.push({ label: name, value: id })
  }
  return opts
})

const activeFilterCount = computed(() => {
  let count = 0
  if (filterDate.value) count++
  if (filterShift.value !== 'ALL') count++
  if (filterGta.value !== 'ALL') count++
  if (filterStatus.value !== 'ALL') count++
  return count
})

const resetFilters = () => {
  filterDate.value = ''
  filterShift.value = 'ALL'
  filterGta.value = 'ALL'
  filterStatus.value = 'ALL'
  expectedPage.value = 1
  completedPage.value = 1
}

watch([filterDate, filterShift, filterGta, filterStatus], () => {
  expectedPage.value = 1
  completedPage.value = 1
})

const getLocalDateStr = (dateInput: string | Date) => {
  const d = new Date(dateInput)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const matchesCommonFilters = (res: any) => {
  if (filterDate.value) {
    const resDate = getLocalDateStr(res.startTime)
    if (resDate !== filterDate.value) return false
  }
  if (filterShift.value !== 'ALL') {
    const d = new Date(res.startTime)
    const isMorning = d.getHours() < 12 || (d.getHours() === 12 && d.getMinutes() < 30)
    if (filterShift.value === 'MORNING' && !isMorning) return false
    if (filterShift.value === 'AFTERNOON' && isMorning) return false
  }
  if (filterGta.value !== 'ALL') {
    const resGtaId = res.gtaId || res.gta?.id
    if (resGtaId !== filterGta.value) return false
  }
  return true
}

const filteredExpectedArrivals = computed(() => {
  return expectedArrivals.value.filter((res: any) => {
    if (!matchesCommonFilters(res)) return false
    if (filterStatus.value !== 'ALL' && filterStatus.value !== 'SCHEDULED') {
      return false
    }
    return true
  })
})

const paginatedExpectedArrivals = computed(() => {
  const start = (expectedPage.value - 1) * expectedPageSize
  return filteredExpectedArrivals.value.slice(start, start + expectedPageSize)
})

const filteredCompletedList = computed(() => {
  return completedList.value.filter((res: any) => {
    if (!matchesCommonFilters(res)) return false
    if (filterStatus.value !== 'ALL' && res.status !== filterStatus.value) {
      return false
    }
    return true
  })
})

const paginatedCompletedList = computed(() => {
  const start = (completedPage.value - 1) * completedPageSize
  return filteredCompletedList.value.slice(start, start + completedPageSize)
})

const handleResetScenario = () => {
  if (consoleState.resetScenario) {
    consoleState.resetScenario()
  }
}

const notesDraft = ref('')

watch(
  () => activeInterview.value?.id,
  () => {
    notesDraft.value = activeInterview.value?.notes || ''
  },
  { immediate: true }
)

const handleCheckIn = async (reservationId: string) => {
  await checkIn(reservationId)
}

const showCancelCheckInModal = ref(false)

const confirmCancelCheckIn = () => {
  showCancelCheckInModal.value = true
}

const executeCancelCheckIn = async () => {
  if (!activeInterview.value) return
  try {
    await cancelCheckIn(activeInterview.value.id)
    showCancelCheckInModal.value = false
    notesDraft.value = ''
  } catch {
    // Handled in composable
  }
}

const handleCheckOut = async () => {
  if (!activeInterview.value) return
  await checkOut(activeInterview.value.id, notesDraft.value)
}

const handleSaveNotes = async () => {
  if (!activeInterview.value) return
  if (updateInterview) {
    await updateInterview(activeInterview.value.id, { notes: notesDraft.value })
  } else {
    await saveNotes(activeInterview.value.id, notesDraft.value)
  }
}

const showEditNotesModal = ref(false)
const targetEditNotes = ref<any | null>(null)
const editNotesDraft = ref('')
const editStatusDraft = ref('COMPLETED')

const editStatusOptions = [
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Missed (No-Show)', value: 'MISSED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Scheduled (Revert to Expected)', value: 'SCHEDULED' }
]

const openEditNotesModal = (reservation: any) => {
  targetEditNotes.value = reservation
  editNotesDraft.value = reservation.notes || ''
  editStatusDraft.value = reservation.status || 'COMPLETED'
  showEditNotesModal.value = true
}

const executeSaveEditNotes = async () => {
  if (!targetEditNotes.value) return
  try {
    if (updateInterview) {
      await updateInterview(targetEditNotes.value.id, {
        notes: editNotesDraft.value,
        status: editStatusDraft.value
      })
    } else {
      await saveNotes(targetEditNotes.value.id, editNotesDraft.value)
    }
    showEditNotesModal.value = false
    targetEditNotes.value = null
  } catch {
    // Handled in composable
  }
}

const handleReinstate = async (reservationId: string) => {
  await reinstateReservation(reservationId)
}

const showNoShowModal = ref(false)
const targetNoShow = ref<any | null>(null)

const confirmNoShow = (reservation: any) => {
  targetNoShow.value = reservation
  showNoShowModal.value = true
}

const executeNoShow = async () => {
  if (!targetNoShow.value) return
  try {
    await markNoShow(targetNoShow.value.id)
    showNoShowModal.value = false
    targetNoShow.value = null
  } catch {
    // Handled in composable
  }
}

const formatStudentName = (student?: any) => {
  if (!student) return 'Student'
  const full = `${student.firstName || ''} ${student.lastName || ''}`.trim()
  return full || student.email || 'Student'
}

const formatTimeOnly = (dateStr?: string | Date) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatSlotRange = (startStr: string, endStr: string) => {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const dateFmt = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const startFmt = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endFmt = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${dateFmt}, ${startFmt} – ${endFmt}`
}

const statusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'CHECKED_OUT':
      return 'success'
    case 'MISSED':
      return 'error'
    case 'CHECKED_IN':
      return 'primary'
    default:
      return 'neutral'
  }
}
</script>
