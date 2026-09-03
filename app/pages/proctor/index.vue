<template>
  <div class="space-y-6">
    <!-- Top Command Center Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div
          class="p-3 bg-primary-100 dark:bg-primary-950/50 rounded-lg text-primary-600 dark:text-primary-400"
        >
          <UIcon name="i-lucide-building-2" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {{ facility?.name || 'Testing Center Console' }}
            </h1>
            <UBadge :color="isOnDuty ? 'success' : 'neutral'" variant="subtle" size="xs">
              {{ isOnDuty ? 'ON DUTY' : 'OFF DUTY' }}
            </UBadge>
          </div>
          <p class="text-xs text-neutral-500 font-mono">
            {{ liveClock }} • {{ facility?.totalSeats || 48 }} Total Workstations
          </p>
        </div>
      </div>

      <!-- Quick KPI Counters & Duty Toggle -->
      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-3">
          <div class="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-center">
            <span class="block text-xs text-neutral-500 font-medium">Seated</span>
            <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {{ counts.seated }} / {{ facility?.totalSeats || 48 }}
            </span>
          </div>

          <div class="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-center">
            <span class="block text-xs text-neutral-500 font-medium">Arriving</span>
            <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {{ counts.arriving }}
            </span>
          </div>

          <div class="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-center">
            <span class="block text-xs text-neutral-500 font-medium">Departing Soon</span>
            <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {{ counts.departures }}
            </span>
          </div>
        </div>

        <UButton
          size="sm"
          color="warning"
          variant="soft"
          icon="i-lucide-file-warning"
          label="Add Incident / Note"
          @click="openNoteModal()"
        />

        <div
          class="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800"
        >
          <span class="text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >Proctor Duty</span
          >
          <USwitch :model-value="isOnDuty" @update:model-value="toggleDuty" />
        </div>
      </div>
    </div>

    <!-- Last Action Feedback Banner -->
    <div
      v-if="lastAction"
      class="flex items-center justify-between p-3 rounded-lg border text-sm transition-all"
      :class="[
        lastAction.type === 'checkin'
          ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
      ]"
    >
      <div class="flex items-center gap-2 font-medium">
        <UIcon
          :name="
            lastAction.type === 'checkin'
              ? 'i-lucide-check-circle-2'
              : 'i-lucide-arrow-right-circle'
          "
          class="w-5 h-5 flex-shrink-0"
        />
        <span>{{ lastAction.message }}</span>
      </div>
      <span class="text-xs opacity-75">
        {{
          lastAction.time.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
          })
        }}
      </span>
    </div>

    <!-- Main Two-Column Layout (Option A) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Card Swipe Station (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <BaseCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h2
                class="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
              >
                <UIcon name="i-lucide-credit-card" class="w-5 h-5 text-primary-500" />
                <span>ID Card Swipe Station</span>
              </h2>
              <UBadge color="primary" variant="subtle" size="xs"> Auto-Focus </UBadge>
            </div>

            <p class="text-xs text-neutral-500">
              Swipe student ID card or manually type ID and press Enter. Supports magnetic stripe
              readers and barcode scanners.
            </p>

            <form @submit.prevent="handleSwipeSubmit">
              <div class="relative">
                <UInput
                  ref="swipeInputRef"
                  v-model="rawSwipeInput"
                  placeholder="Swipe card or enter Student ID..."
                  size="lg"
                  autofocus
                  autocomplete="off"
                  class="w-full font-mono text-base"
                  :disabled="lookupLoading"
                />
                <div class="absolute right-2.5 top-2.5">
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    type="submit"
                    :loading="lookupLoading"
                    label="Lookup"
                  />
                </div>
              </div>
            </form>

            <div
              v-if="lookupError"
              class="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
            >
              {{ lookupError }}
            </div>

            <!-- Student Verification Card -->
            <div
              v-if="lookupResult"
              class="mt-4 p-4 rounded-xl border transition-all space-y-4"
              :class="[
                lookupResult.decision === 'READY_FOR_CHECKIN'
                  ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                  : lookupResult.decision === 'READY_FOR_CHECKOUT'
                    ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                    : lookupResult.decision === 'EARLY' || lookupResult.decision === 'LATE'
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
              ]"
            >
              <!-- Photo & Student Info -->
              <div class="flex items-start gap-4">
                <div class="relative flex-shrink-0">
                  <img
                    v-if="lookupResult.student?.avatarUrl"
                    :src="lookupResult.student.avatarUrl"
                    alt="Student Photo"
                    class="w-20 h-20 rounded-lg object-cover border border-neutral-300 dark:border-neutral-700 shadow-sm"
                  />
                  <div
                    v-else
                    class="w-20 h-20 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center border border-neutral-300 dark:border-neutral-700"
                  >
                    <UIcon name="i-lucide-user" class="w-10 h-10 text-neutral-400" />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h3 class="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {{ lookupResult.student?.firstName }} {{ lookupResult.student?.lastName }}
                    </h3>
                    <div
                      v-if="lookupResult.reservation?.seatNumber"
                      class="px-2.5 py-1 rounded-md bg-primary-600 text-white font-mono font-bold text-xs shadow-sm"
                    >
                      Seat #{{ lookupResult.reservation.seatNumber }}
                    </div>
                  </div>

                  <p class="text-xs text-neutral-500 font-mono mt-0.5">
                    ID: {{ lookupResult.student?.studentId || '—' }}
                  </p>
                  <p
                    class="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mt-1 truncate"
                  >
                    {{ lookupResult.reservation?.assignmentTitle || 'No Active Assignment' }}
                  </p>
                  <p v-if="lookupResult.reservation?.startTime" class="text-xs text-neutral-500">
                    Slot: {{ formatSlotTime(lookupResult.reservation.startTime) }}
                  </p>
                </div>
              </div>

              <!-- Message Prompt -->
              <div
                class="p-3 rounded-lg text-xs font-medium"
                :class="[
                  lookupResult.decision === 'READY_FOR_CHECKIN'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-200'
                    : lookupResult.decision === 'READY_FOR_CHECKOUT'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200'
                      : lookupResult.decision === 'EARLY' || lookupResult.decision === 'LATE'
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-200'
                ]"
              >
                {{ lookupResult.message }}
              </div>

              <!-- Action Buttons -->
              <div
                class="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800"
              >
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  label="Clear"
                  @click="clearAndRefocus"
                />

                <!-- Add Incident Note Action -->
                <UButton
                  v-if="lookupResult.reservation"
                  size="sm"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-file-plus-2"
                  label="Add Note"
                  @click="
                    openNoteModal({
                      reservationId: lookupResult.reservation.id,
                      seatNumber: lookupResult.reservation.seatNumber,
                      studentName:
                        `${lookupResult.student?.firstName} ${lookupResult.student?.lastName}`.trim(),
                      assignmentTitle: lookupResult.reservation.assignmentTitle,
                      notes: lookupResult.reservation.notes
                    })
                  "
                />

                <!-- Check In Action -->
                <UButton
                  v-if="
                    lookupResult.decision === 'READY_FOR_CHECKIN' ||
                    lookupResult.decision === 'LATE'
                  "
                  size="sm"
                  color="success"
                  icon="i-lucide-check-circle"
                  :loading="lookupLoading"
                  :label="
                    lookupResult.decision === 'LATE'
                      ? 'Override & Check In'
                      : 'Confirm Check-In (Enter)'
                  "
                  @click="handleCheckInConfirm"
                />

                <!-- Check Out Action -->
                <UButton
                  v-if="lookupResult.decision === 'READY_FOR_CHECKOUT'"
                  size="sm"
                  color="primary"
                  icon="i-lucide-log-out"
                  :loading="lookupLoading"
                  label="Confirm Check-Out (Enter)"
                  @click="handleCheckOutConfirm"
                />
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Right Column: Live Roster & Feeds (7 cols) -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Sub-Navigation Tabs -->
        <div class="flex border-b border-neutral-200 dark:border-neutral-800 gap-6">
          <button
            type="button"
            class="pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer flex items-center gap-2"
            :class="[
              activeFeedTab === 'seated'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            ]"
            @click="activeFeedTab = 'seated'"
          >
            <UIcon name="i-lucide-armchair" class="w-4 h-4" />
            <span>Currently Seated</span>
            <span
              class="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 font-mono"
            >
              {{ seated.length }}
            </span>
          </button>

          <button
            type="button"
            class="pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer flex items-center gap-2"
            :class="[
              activeFeedTab === 'arriving'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            ]"
            @click="activeFeedTab = 'arriving'"
          >
            <UIcon name="i-lucide-user-check" class="w-4 h-4" />
            <span>Expected Arrivals</span>
            <span
              class="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 font-mono"
            >
              {{ arriving.length }}
            </span>
          </button>

          <button
            type="button"
            class="pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer flex items-center gap-2"
            :class="[
              activeFeedTab === 'departures'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            ]"
            @click="activeFeedTab = 'departures'"
          >
            <UIcon name="i-lucide-clock" class="w-4 h-4" />
            <span>Departures</span>
            <span
              class="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 font-mono"
            >
              {{ departures.length }}
            </span>
          </button>
        </div>

        <!-- Tab 1: Currently Seated Roster -->
        <div v-if="activeFeedTab === 'seated'">
          <BaseDataTable
            :data="seated"
            :columns="seatedColumns"
            empty-icon="i-lucide-armchair"
            empty-text="No students currently seated."
          />
        </div>

        <!-- Tab 2: Expected Arrivals -->
        <div v-else-if="activeFeedTab === 'arriving'">
          <BaseDataTable
            :data="arriving"
            :columns="arrivingColumns"
            empty-icon="i-lucide-users"
            empty-text="No arriving students scheduled in this window."
          />
        </div>

        <!-- Tab 3: Departures Feed -->
        <div v-else-if="activeFeedTab === 'departures'">
          <BaseDataTable
            :data="departures"
            :columns="departureColumns"
            empty-icon="i-lucide-check-check"
            empty-text="No departures pending or recently completed."
          />
        </div>
      </div>
    </div>

    <!-- Proctor Incident / Observation Note Modal -->
    <FeaturesProctorProctorNoteModal
      v-model="isNoteModalOpen"
      :target="selectedNoteTarget"
      :seated-roster="seated"
      @submit="handleSaveNote"
    />
  </div>
</template>

<script setup lang="ts">
import { useCbtfProctor } from '~/composables/features/proctor/useCbtfProctor'

definePageMeta({
  middleware: ['proctor-only']
})

const {
  isOnDuty,
  toggleDuty,
  facility,
  counts,
  seated,
  arriving,
  departures,
  lookupResult,
  lookupLoading,
  lookupError,
  lastAction,
  lookupStudent,
  confirmCheckIn,
  confirmCheckOut,
  clearLookup,
  isNoteModalOpen,
  selectedNoteTarget,
  openNoteModal,
  addNote
} = useCbtfProctor()

const handleSaveNote = async (payload: {
  reservationId?: string
  seatNumber?: number
  content: string
  hasPhotos: boolean
}) => {
  await addNote(payload)
}

const activeFeedTab = ref('seated')
const rawSwipeInput = ref('')
const swipeInputRef = ref<any>(null)

// Live Digital Clock
const liveClock = ref('')
let clockTimer: any = null

onMounted(() => {
  const updateClock = () => {
    liveClock.value = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const clearAndRefocus = () => {
  clearLookup()
  rawSwipeInput.value = ''
  nextTick(() => {
    swipeInputRef.value?.$el?.querySelector('input')?.focus()
  })
}

const handleSwipeSubmit = async () => {
  if (lookupResult.value) {
    if (
      lookupResult.value.decision === 'READY_FOR_CHECKIN' ||
      lookupResult.value.decision === 'LATE'
    ) {
      await handleCheckInConfirm()
      return
    }
    if (lookupResult.value.decision === 'READY_FOR_CHECKOUT') {
      await handleCheckOutConfirm()
      return
    }
  }

  if (!rawSwipeInput.value) return
  await lookupStudent(rawSwipeInput.value)
  rawSwipeInput.value = ''
}

const handleCheckInConfirm = async () => {
  if (!lookupResult.value?.reservation?.id) return
  await confirmCheckIn(lookupResult.value.reservation.id)
  clearAndRefocus()
}

const handleCheckOutConfirm = async () => {
  if (!lookupResult.value?.reservation?.id) return
  await confirmCheckOut(lookupResult.value.reservation.id)
  clearAndRefocus()
}

const formatSlotTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

// Columns: Currently Seated
const seatedColumns: any[] = [
  {
    accessorKey: 'seatNumber',
    header: 'Seat',
    cell: ({ row }: { row: any }) =>
      h(
        'span',
        {
          class:
            'px-2 py-1 rounded bg-primary-100 dark:bg-primary-950/60 font-mono font-bold text-primary-700 dark:text-primary-300'
        },
        `#${row.original.seatNumber}`
      )
  },
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) =>
      h('div', { class: 'flex flex-col' }, [
        h(
          'span',
          { class: 'font-semibold text-neutral-900 dark:text-neutral-100' },
          row.original.studentName || '—'
        ),
        row.original.studentId &&
          h(
            'span',
            { class: 'text-xs text-neutral-500 font-mono' },
            `ID: ${row.original.studentId}`
          )
      ])
  },
  {
    accessorKey: 'assignmentTitle',
    header: 'Assignment',
    cell: ({ row }: { row: any }) =>
      h(
        'span',
        { class: 'text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[140px] block' },
        row.original.assignmentTitle || '—'
      )
  },
  {
    accessorKey: 'remainingMinutes',
    header: 'Time Left',
    cell: ({ row }: { row: any }) => {
      const remaining = row.original.remainingMinutes ?? 0
      const isUrgent = remaining <= 10
      return h(
        'span',
        {
          class: [
            'font-mono font-semibold text-xs px-2 py-0.5 rounded-full',
            isUrgent
              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 animate-pulse'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
          ]
        },
        `${remaining} min`
      )
    }
  },
  {
    id: 'actions',
    header: 'Action',
    cell: ({ row }: { row: any }) =>
      h('div', { class: 'flex items-center gap-1.5' }, [
        h(resolveComponent('UButton'), {
          size: 'xs',
          color: row.original.noteCount ? 'warning' : 'neutral',
          variant: row.original.noteCount ? 'solid' : 'ghost',
          icon: row.original.noteCount ? 'i-lucide-file-warning' : 'i-lucide-file-plus-2',
          label: row.original.noteCount ? `Notes (${row.original.noteCount})` : 'Note',
          title: 'Add or view notes for this student',
          onClick: () =>
            openNoteModal({
              reservationId: row.original.id,
              seatNumber: row.original.seatNumber,
              studentName: row.original.studentName,
              assignmentTitle: row.original.assignmentTitle,
              notes: row.original.notes
            })
        }),
        h(resolveComponent('UButton'), {
          size: 'xs',
          color: 'primary',
          variant: 'soft',
          icon: 'i-lucide-log-out',
          label: 'Check Out',
          onClick: () => confirmCheckOut(row.original.id)
        })
      ])
  }
]

// Columns: Expected Arrivals
const arrivingColumns: any[] = [
  {
    accessorKey: 'seatNumber',
    header: 'Seat',
    cell: ({ row }: { row: any }) =>
      h(
        'span',
        { class: 'font-mono font-semibold text-neutral-600 dark:text-neutral-400' },
        `#${row.original.seatNumber}`
      )
  },
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) =>
      h('div', { class: 'flex flex-col' }, [
        h(
          'span',
          { class: 'font-semibold text-neutral-900 dark:text-neutral-100' },
          row.original.studentName || '—'
        ),
        row.original.studentId &&
          h(
            'span',
            { class: 'text-xs text-neutral-500 font-mono' },
            `ID: ${row.original.studentId}`
          )
      ])
  },
  {
    accessorKey: 'startTime',
    header: 'Scheduled Slot',
    cell: ({ row }: { row: any }) =>
      h(
        'span',
        { class: 'text-xs text-neutral-600 dark:text-neutral-400' },
        formatSlotTime(row.original.startTime)
      )
  },
  {
    id: 'actions',
    header: 'Action',
    cell: ({ row }: { row: any }) =>
      h(resolveComponent('UButton'), {
        size: 'xs',
        color: 'success',
        variant: 'soft',
        icon: 'i-lucide-check',
        label: 'Check In',
        onClick: () => confirmCheckIn(row.original.id)
      })
  }
]

// Columns: Departures Feed
const departureColumns: any[] = [
  {
    accessorKey: 'seatNumber',
    header: 'Seat',
    cell: ({ row }: { row: any }) =>
      h('span', { class: 'font-mono font-semibold' }, `#${row.original.seatNumber}`)
  },
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) =>
      h('span', { class: 'font-semibold' }, row.original.studentName || '—')
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: any }) =>
      h(
        resolveComponent('UBadge'),
        {
          size: 'xs',
          variant: 'subtle',
          color: row.original.status === 'CHECKED_OUT' ? 'neutral' : 'amber'
        },
        () => (row.original.status === 'CHECKED_OUT' ? 'Checked Out' : 'Ending Soon')
      )
  }
]
</script>
