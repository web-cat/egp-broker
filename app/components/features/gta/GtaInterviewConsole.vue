<template>
  <div class="space-y-6">
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
            to="/"
          />
          <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <UIcon name="i-lucide-user-check" class="w-6 h-6 text-primary-500" />
            Graduate TA Interview Console
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
          icon="i-lucide-refresh-cw"
          variant="outline"
          color="neutral"
          size="sm"
          :loading="feedStatus === 'pending'"
          @click="() => refreshFeed()"
        />
      </div>
    </div>

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
            v-if="expectedArrivals.length > 0"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ expectedArrivals.length }}
          </UBadge>
        </h3>
      </div>

      <div v-if="expectedArrivals.length === 0" class="p-8 text-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30">
        <UIcon name="i-lucide-calendar-check" class="w-8 h-8 mx-auto text-neutral-400 mb-2" />
        <p class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          No upcoming arrivals scheduled for your shift today.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="reservation in expectedArrivals"
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
    </div>

    <!-- Completed & Past Shift Appointments -->
    <div v-if="completedList.length > 0" class="space-y-4 pt-4">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UIcon name="i-lucide-history" class="w-5 h-5 text-neutral-500" />
          Shift History & Completed
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ completedList.length }}
          </UBadge>
        </h3>
      </div>

      <div class="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table class="w-full text-left text-xs">
          <thead class="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 uppercase font-semibold border-b border-neutral-200 dark:border-neutral-800">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Assignment</th>
              <th class="px-4 py-3">Time</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
            <tr v-for="res in completedList" :key="res.id">
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
              <td class="px-4 py-3">
                <UBadge :color="statusColor(res.status)" variant="subtle" size="xs">
                  {{ res.status }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                {{ res.notes || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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

const props = defineProps<{
  courseId: string
  courseTitle?: string | null
  courseCode?: string | null
  interviewLocation?: string | null
}>()

const effectiveLocation = computed(() => props.interviewLocation || '')

const {
  activeInterview,
  expectedArrivals,
  completedList,
  feedStatus,
  isUpdating,
  refreshFeed,
  checkIn,
  checkOut,
  saveNotes,
  markNoShow
} = useGtaInterviewConsole(computed(() => props.courseId))

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

const handleCheckOut = async () => {
  if (!activeInterview.value) return
  await checkOut(activeInterview.value.id, notesDraft.value)
}

const handleSaveNotes = async () => {
  if (!activeInterview.value) return
  await saveNotes(activeInterview.value.id, notesDraft.value)
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
