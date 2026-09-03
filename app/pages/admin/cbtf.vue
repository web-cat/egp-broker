<template>
  <div class="space-y-6">
    <UPageHeader
      title="Testing Center Administration"
      description="Configure facility capacity, weekly operating hours, holiday exceptions, proctor shifts, and view global reservations."
      icon="i-lucide-building-2"
    />

    <!-- Navigation Tabs -->
    <div class="flex border-b border-neutral-200 dark:border-neutral-800 gap-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer"
        :class="[
          activeTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
        ]"
        @click="activeTab = tab.id"
      >
        <div class="flex items-center gap-2">
          <UIcon :name="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
        </div>
      </button>
    </div>

    <!-- Tab 1: Facility Settings -->
    <div v-if="activeTab === 'facility'" class="space-y-6 max-w-2xl">
      <BaseCard>
        <div class="space-y-4">
          <h3 class="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Workstation & Allocation Configuration
          </h3>

          <BaseFormInput
            v-model="facilityForm.name"
            name="name"
            label="Facility Name"
            placeholder="Main Testing Center"
          />

          <BaseFormInput
            v-model.number="facilityForm.totalSeats"
            name="totalSeats"
            label="Total Workstation Seats"
            type="number"
            min="1"
            max="500"
          />

          <div class="space-y-1">
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Sequential Seat Allocation Order
            </label>
            <p class="text-xs text-neutral-500">
              Comma-separated list of seat numbers in the exact order they should be assigned.
            </p>
            <UTextarea
              v-model="facilityForm.seatAllocationOrderStr"
              rows="3"
              class="font-mono text-xs w-full"
              placeholder="1, 15, 29, 2, 16, 30..."
            />
            <div class="flex justify-between items-center pt-1">
              <span class="text-xs text-neutral-500">
                Parsed seats: {{ parsedSeatsCount }} seat numbers
              </span>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                label="Reset to 1..N"
                @click="resetSeatOrder"
              />
            </div>
          </div>

          <div class="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
            <UButton
              color="primary"
              label="Save Facility Settings"
              icon="i-lucide-save"
              :loading="savingFacility"
              @click="handleSaveFacility"
            />
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Tab 2: Weekly Operating Hours -->
    <div v-else-if="activeTab === 'hours'" class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Standard recurring weekly operating hours. Testing slots are generated in 5-minute
          increments between open and 1 hour before close.
        </p>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Set Hours"
          @click="openHoursModal(null)"
        />
      </div>

      <BaseDataTable
        :data="sortedOperatingHours"
        :columns="hoursColumns"
        empty-icon="i-lucide-clock"
        empty-text="No operating hours configured yet."
      />
    </div>

    <!-- Tab 3: Schedule Exceptions -->
    <div v-else-if="activeTab === 'exceptions'" class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Overrides for holidays, exam breaks, or special modified hours on specific dates.
        </p>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Add Exception"
          @click="showExceptionModal = true"
        />
      </div>

      <BaseDataTable
        :data="facility?.scheduleExceptions || []"
        :columns="exceptionColumns"
        empty-icon="i-lucide-calendar-off"
        empty-text="No schedule exceptions added."
      />
    </div>

    <!-- Tab 4: Proctor Shifts -->
    <div v-else-if="activeTab === 'shifts'" class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Staff coverage and proctor shift scheduling.
        </p>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Add Shift"
          @click="showShiftModal = true"
        />
      </div>

      <BaseDataTable
        :data="shifts"
        :columns="shiftColumns"
        empty-icon="i-lucide-users"
        empty-text="No proctor shifts scheduled."
      />
    </div>

    <!-- Tab 5: All Reservations -->
    <div v-else-if="activeTab === 'reservations'" class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Global audit log of all CBTF exam reservations across courses.
        </p>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          label="Refresh"
          @click="refreshReservations"
        />
      </div>

      <BaseDataTable
        :data="reservations"
        :columns="reservationColumns"
        searchable
        search-placeholder="Search reservations…"
        empty-icon="i-lucide-clipboard-check"
        empty-text="No reservations found."
      />
    </div>

    <!-- Modal: Operating Hours Upsert -->
    <UModal v-model:open="showHoursModal" title="Set Weekly Operating Hours">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Day of Week">
            <USelect v-model="hoursForm.dayOfWeek" :items="dayOfWeekOptions" class="w-full" />
          </UFormField>
          <BaseFormInput
            v-model="hoursForm.openTime"
            name="openTime"
            label="Open Time (HH:mm)"
            placeholder="08:00"
          />
          <BaseFormInput
            v-model="hoursForm.closeTime"
            name="closeTime"
            label="Close Time (HH:mm)"
            placeholder="18:00"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showHoursModal = false"
          />
          <UButton color="primary" label="Save Hours" @click="handleSaveHours" />
        </div>
      </template>
    </UModal>

    <!-- Modal: Schedule Exception Create -->
    <UModal v-model:open="showExceptionModal" title="Add Schedule Exception">
      <template #body>
        <div class="space-y-4">
          <BaseFormInput v-model="exceptionForm.date" name="date" label="Date" type="date" />
          <div
            class="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
          >
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Closed All Day
              </p>
              <p class="text-xs text-neutral-500">Center will be closed completely on this date</p>
            </div>
            <USwitch v-model="exceptionForm.isClosed" />
          </div>
          <div v-if="!exceptionForm.isClosed" class="grid grid-cols-2 gap-3">
            <BaseFormInput
              v-model="exceptionForm.openTime"
              name="openTime"
              label="Open Time"
              placeholder="10:00"
            />
            <BaseFormInput
              v-model="exceptionForm.closeTime"
              name="closeTime"
              label="Close Time"
              placeholder="14:00"
            />
          </div>
          <BaseFormInput
            v-model="exceptionForm.reason"
            name="reason"
            label="Reason"
            placeholder="e.g. Labor Day, Maintenance"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showExceptionModal = false"
          />
          <UButton color="primary" label="Save Exception" @click="handleSaveException" />
        </div>
      </template>
    </UModal>

    <!-- Modal: Proctor Shift Create -->
    <UModal v-model:open="showShiftModal" title="Schedule Proctor Shift">
      <template #body>
        <div class="space-y-4">
          <BaseFormInput
            v-model="shiftForm.userId"
            name="userId"
            label="Proctor User ID"
            placeholder="Enter user cuid..."
          />
          <BaseFormInput
            v-model="shiftForm.startTime"
            name="startTime"
            label="Shift Start Time"
            type="datetime-local"
          />
          <BaseFormInput
            v-model="shiftForm.endTime"
            name="endTime"
            label="Shift End Time"
            type="datetime-local"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showShiftModal = false"
          />
          <UButton color="primary" label="Create Shift" @click="handleSaveShift" />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useCbtfAdmin } from '~/composables/features/admin/useCbtfAdmin'

definePageMeta({
  middleware: ['admin-only']
})

const {
  facility,
  shifts,
  reservations,
  refreshReservations,
  saveFacility,
  upsertOperatingHours,
  deleteOperatingHours,
  createException,
  deleteException,
  createShift,
  deleteShift,
  updateReservation
} = useCbtfAdmin()

const tabs = [
  { id: 'facility', label: 'Facility Settings', icon: 'i-lucide-sliders' },
  { id: 'hours', label: 'Operating Hours', icon: 'i-lucide-clock' },
  { id: 'exceptions', label: 'Exceptions', icon: 'i-lucide-calendar-off' },
  { id: 'shifts', label: 'Proctor Shifts', icon: 'i-lucide-users' },
  { id: 'reservations', label: 'Reservations Log', icon: 'i-lucide-clipboard-list' }
]

const activeTab = ref('facility')

// --- Facility Form State ---
const savingFacility = ref(false)
const facilityForm = reactive({
  name: '',
  totalSeats: 48,
  seatAllocationOrderStr: ''
})

const parsedSeatsCount = computed(() => {
  return facilityForm.seatAllocationOrderStr
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0).length
})

const resetSeatOrder = () => {
  const seats = Array.from({ length: facilityForm.totalSeats }, (_, i) => i + 1)
  facilityForm.seatAllocationOrderStr = seats.join(', ')
}

watch(
  facility,
  (fac) => {
    if (fac) {
      facilityForm.name = fac.name || ''
      facilityForm.totalSeats = fac.totalSeats || 48
      const order = Array.isArray(fac.seatAllocationOrder) ? fac.seatAllocationOrder : []
      facilityForm.seatAllocationOrderStr = order.join(', ')
    }
  },
  { immediate: true }
)

const handleSaveFacility = async () => {
  savingFacility.value = true
  try {
    const order = facilityForm.seatAllocationOrderStr
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)

    await saveFacility({
      name: facilityForm.name,
      totalSeats: facilityForm.totalSeats,
      seatAllocationOrder: order.length > 0 ? order : undefined
    })
  } finally {
    savingFacility.value = false
  }
}

// --- Operating Hours State ---
const showHoursModal = ref(false)
const hoursForm = reactive({
  dayOfWeek: 1,
  openTime: '08:00',
  closeTime: '18:00'
})

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayOfWeekOptions = dayNames.map((name, i) => ({ label: name, value: i }))

const sortedOperatingHours = computed(() => {
  const list = facility.value?.operatingHours ? [...facility.value.operatingHours] : []
  return list.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek)
})

const hoursColumns: any[] = [
  {
    accessorKey: 'dayOfWeek',
    header: 'Day',
    cell: ({ row }: { row: any }) => dayNames[row.original.dayOfWeek]
  },
  {
    accessorKey: 'openTime',
    header: 'Opens',
    cell: ({ row }: { row: any }) => row.original.openTime
  },
  {
    accessorKey: 'closeTime',
    header: 'Closes',
    cell: ({ row }: { row: any }) => row.original.closeTime
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: any }) =>
      h(resolveComponent('UButton'), {
        color: 'error',
        variant: 'ghost',
        size: 'xs',
        icon: 'i-lucide-trash-2',
        onClick: () => {
          if (confirm('Delete operating hours for this day?')) {
            deleteOperatingHours(row.original.id)
          }
        }
      })
  }
]

const openHoursModal = (existing: any) => {
  if (existing) {
    hoursForm.dayOfWeek = existing.dayOfWeek
    hoursForm.openTime = existing.openTime
    hoursForm.closeTime = existing.closeTime
  }
  showHoursModal.value = true
}

const handleSaveHours = async () => {
  await upsertOperatingHours(hoursForm.dayOfWeek, hoursForm.openTime, hoursForm.closeTime)
  showHoursModal.value = false
}

// --- Exception State ---
const showExceptionModal = ref(false)
const exceptionForm = reactive({
  date: '',
  isClosed: true,
  openTime: '',
  closeTime: '',
  reason: ''
})

const exceptionColumns: any[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }: { row: any }) => new Date(row.original.date).toLocaleDateString()
  },
  {
    accessorKey: 'status',
    header: 'Type',
    cell: ({ row }: { row: any }) =>
      row.original.isClosed
        ? h(
            resolveComponent('UBadge'),
            { color: 'error', variant: 'subtle', size: 'xs' },
            () => 'Closed All Day'
          )
        : h(
            resolveComponent('UBadge'),
            { color: 'warning', variant: 'subtle', size: 'xs' },
            () => `${row.original.openTime} – ${row.original.closeTime}`
          )
  },
  {
    accessorKey: 'reason',
    header: 'Reason',
    cell: ({ row }: { row: any }) => row.original.reason || '—'
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: any }) =>
      h(resolveComponent('UButton'), {
        color: 'error',
        variant: 'ghost',
        size: 'xs',
        icon: 'i-lucide-trash-2',
        onClick: () => {
          if (confirm('Delete this schedule exception?')) {
            deleteException(row.original.id)
          }
        }
      })
  }
]

const handleSaveException = async () => {
  if (!exceptionForm.date) return
  await createException({
    date: exceptionForm.date,
    isClosed: exceptionForm.isClosed,
    openTime: exceptionForm.openTime || null,
    closeTime: exceptionForm.closeTime || null,
    reason: exceptionForm.reason || null
  })
  showExceptionModal.value = false
  exceptionForm.date = ''
  exceptionForm.reason = ''
}

// --- Shifts State ---
const showShiftModal = ref(false)
const shiftForm = reactive({
  userId: '',
  startTime: '',
  endTime: ''
})

const shiftColumns: any[] = [
  {
    accessorKey: 'proctor',
    header: 'Proctor',
    cell: ({ row }: { row: any }) =>
      `${row.original.user?.firstName || ''} ${row.original.user?.lastName || ''} (${row.original.user?.email || '—'})`
  },
  {
    accessorKey: 'startTime',
    header: 'Shift Start',
    cell: ({ row }: { row: any }) => new Date(row.original.startTime).toLocaleString()
  },
  {
    accessorKey: 'endTime',
    header: 'Shift End',
    cell: ({ row }: { row: any }) => new Date(row.original.endTime).toLocaleString()
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: any }) =>
      h(resolveComponent('UButton'), {
        color: 'error',
        variant: 'ghost',
        size: 'xs',
        icon: 'i-lucide-trash-2',
        onClick: () => {
          if (confirm('Delete this proctor shift?')) {
            deleteShift(row.original.id)
          }
        }
      })
  }
]

const handleSaveShift = async () => {
  if (!shiftForm.userId || !shiftForm.startTime || !shiftForm.endTime) return
  await createShift({
    userId: shiftForm.userId,
    startTime: new Date(shiftForm.startTime).toISOString(),
    endTime: new Date(shiftForm.endTime).toISOString()
  })
  showShiftModal.value = false
  shiftForm.userId = ''
  shiftForm.startTime = ''
  shiftForm.endTime = ''
}

// --- Reservations Table ---
const reservationColumns: any[] = [
  {
    accessorKey: 'studentName',
    header: 'Student',
    cell: ({ row }: { row: any }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-semibold' }, row.original.studentName || '—'),
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
    cell: ({ row }: { row: any }) => row.original.assignmentTitle || '—'
  },
  {
    accessorKey: 'seatNumber',
    header: 'Seat',
    cell: ({ row }: { row: any }) =>
      h(
        'span',
        { class: 'font-bold font-mono text-primary-600 dark:text-primary-400' },
        `#${row.original.seatNumber}`
      )
  },
  {
    accessorKey: 'startTime',
    header: 'Scheduled Time',
    cell: ({ row }: { row: any }) => new Date(row.original.startTime).toLocaleString()
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: any }) => {
      const color =
        row.original.status === 'SCHEDULED'
          ? 'primary'
          : row.original.status === 'CHECKED_IN'
            ? 'success'
            : row.original.status === 'MISSED'
              ? 'error'
              : 'neutral'
      return h(
        resolveComponent('UBadge'),
        { color, variant: 'subtle', size: 'xs' },
        () => row.original.status
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: any }) => {
      if (row.original.status === 'SCHEDULED') {
        return h(resolveComponent('UButton'), {
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          label: 'Cancel',
          onClick: () => {
            if (confirm('Cancel this reservation?')) {
              updateReservation(row.original.id, { status: 'CANCELLED' })
            }
          }
        })
      }
      return '—'
    }
  }
]
</script>
