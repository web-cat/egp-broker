<template>
  <div class="space-y-6">
    <UPageHeader
      title="Testing Center Administration"
      description="Configure facility capacity, weekly operating hours, holiday exceptions, proctor shifts, and view global reservations."
      icon="i-lucide-landmark"
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseFormInput
              v-model.number="facilityForm.checkInLeadMinutes"
              name="checkInLeadMinutes"
              label="Early Check-in Allowance (Minutes)"
              description="Maximum minutes before exam start time a student may check in."
              type="number"
              min="0"
              max="60"
            />
            <BaseFormInput
              v-model.number="facilityForm.checkInGraceMinutes"
              name="checkInGraceMinutes"
              label="Late Check-in Grace Period (Minutes)"
              description="Maximum minutes past exam start time before student is flagged late."
              type="number"
              min="0"
              max="60"
            />
          </div>

          <BaseFormInput
            v-model="facilityForm.timezone"
            name="timezone"
            label="Facility Timezone (IANA)"
            description="Local timezone used for operating hours and exam scheduling (e.g. America/New_York)."
            type="text"
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
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Proctor Coverage & Shift Roster
          </h3>
          <p class="text-xs text-neutral-500">
            Schedule recurring weekly staff hours or manage individual proctor shifts.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            color="primary"
            variant="subtle"
            icon="i-lucide-calendar-days"
            label="Weekly Schedule Builder"
            @click="openWeeklyScheduleModal"
          />
          <UButton color="primary" icon="i-lucide-plus" label="Add Shift" @click="openShiftModal" />
        </div>
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
          <UFormField label="Proctor" required>
            <USelect
              v-model="selectedProctorId"
              :items="proctorOptions"
              placeholder="Select a proctor..."
              class="w-full"
            />
          </UFormField>

          <!-- Add Proctor Section when '+ Add New Proctor...' selected -->
          <div
            v-if="selectedProctorId === ADD_PROCTOR_VALUE"
            class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3 space-y-3"
          >
            <div class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Add New Proctor
            </div>
            <div class="flex gap-2">
              <UInput
                v-model="proctorSearchEmail"
                type="email"
                placeholder="Enter user email..."
                class="flex-1"
                @keydown.enter.prevent="handleSearchProctor"
              />
              <UButton
                label="Search"
                icon="i-lucide-search"
                color="primary"
                variant="subtle"
                :loading="isSearchingProctor"
                @click="handleSearchProctor"
              />
            </div>

            <p v-if="proctorSearchError" class="text-xs text-error-500">
              {{ proctorSearchError }}
            </p>

            <div
              v-if="foundUser"
              class="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium">
                    {{ foundUser.firstName }} {{ foundUser.lastName }}
                  </p>
                  <p class="text-xs text-neutral-500">
                    {{ foundUser.email }} • Current Role:
                    <span class="font-semibold">{{ foundUser.globalRole }}</span>
                  </p>
                </div>
                <UBadge v-if="foundUser.globalRole === 'PROCTOR'" color="success" size="xs">
                  Already Proctor
                </UBadge>
              </div>

              <!-- Already a proctor -->
              <div v-if="foundUser.globalRole === 'PROCTOR'" class="pt-2 flex justify-end">
                <UButton
                  size="xs"
                  color="primary"
                  label="Select This Proctor"
                  @click="handleSelectFoundProctor"
                />
              </div>

              <!-- Confirmation to grant proctor role -->
              <div
                v-else
                class="pt-2 border-t border-neutral-200 dark:border-neutral-700 space-y-2"
              >
                <p class="text-xs text-neutral-600 dark:text-neutral-300">
                  Grant <strong>{{ foundUser.firstName }} {{ foundUser.lastName }}</strong> the
                  <strong>PROCTOR</strong> role?
                </p>
                <div class="flex justify-end gap-2">
                  <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="resetProctorSearch"
                  />
                  <UButton
                    label="Grant Proctor Role"
                    color="primary"
                    size="xs"
                    :loading="isGrantingRole"
                    @click="handleConfirmGrantProctor"
                  />
                </div>
              </div>
            </div>
          </div>

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
          <UButton
            color="primary"
            label="Create Shift"
            :disabled="!shiftForm.userId || !shiftForm.startTime || !shiftForm.endTime"
            @click="handleSaveShift"
          />
        </div>
      </template>
    </UModal>

    <!-- Modal: Weekly Schedule Builder -->
    <UModal
      v-model:open="showWeeklyModal"
      title="Weekly Proctor Schedule Builder"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-xs text-neutral-500">
            Enter a proctor's recurring weekly shift pattern using natural text (or the slot
            builder) and generate concrete shift records across any date range.
          </p>

          <!-- Proctor Selector -->
          <UFormField label="Select Proctor" required>
            <USelect
              v-model="weeklyProctorId"
              :items="proctorOptions.filter((o) => o.value !== ADD_PROCTOR_VALUE)"
              placeholder="Choose a proctor..."
              class="w-full"
            />
          </UFormField>

          <!-- Smart Text / Fast Entry -->
          <div
            class="space-y-1.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Paste / Fast Text Entry
              </label>
              <span class="text-[11px] text-neutral-400">
                Parses days &amp; times automatically
              </span>
            </div>
            <UTextarea
              v-model="weeklyRawText"
              rows="2"
              class="font-mono text-xs w-full"
              placeholder="Mon 2:00–5:00 PM (3.0h), Wed 9:00–11:30 AM (2.5h), Fri 9:00–11:30 AM (2.5h)"
              @input="handleWeeklyTextChange"
            />
            <div class="flex justify-end">
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                icon="i-lucide-sparkles"
                label="Parse Text into Slots"
                @click="handleWeeklyTextChange"
              />
            </div>
          </div>

          <!-- Parsed / Configured Slots List -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Weekly Shift Slots ({{ weeklySlots.length }})
              </span>
              <div class="flex items-center gap-2">
                <UBadge color="primary" variant="subtle" size="sm">
                  Total: {{ weeklyTotalHours }} hrs / week
                </UBadge>
                <UButton
                  size="xs"
                  variant="outline"
                  color="primary"
                  icon="i-lucide-plus"
                  label="Add Slot"
                  @click="addWeeklySlot"
                />
              </div>
            </div>

            <div
              v-if="weeklySlots.length === 0"
              class="p-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg"
            >
              <p class="text-xs text-neutral-500">
                No slots configured yet. Paste shift text above or click "+ Add Slot" to build
                manually.
              </p>
            </div>

            <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div
                v-for="(slot, idx) in weeklySlots"
                :key="idx"
                class="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              >
                <div class="w-36">
                  <USelect
                    v-model="slot.dayOfWeek"
                    :items="dayOfWeekOptions"
                    class="w-full text-xs"
                  />
                </div>
                <div class="flex items-center gap-1.5 flex-1 min-w-[210px]">
                  <UInput v-model="slot.startTime" type="time" class="w-28 text-xs font-mono" />
                  <span class="text-xs text-neutral-400">to</span>
                  <UInput v-model="slot.endTime" type="time" class="w-28 text-xs font-mono" />
                </div>
                <div class="flex items-center gap-2">
                  <UBadge color="neutral" variant="subtle" size="xs">
                    {{ calculateSlotDuration(slot.startTime, slot.endTime) }}h
                  </UBadge>
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-trash-2"
                    @click="removeWeeklySlot(idx)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Date Range Target -->
          <div class="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Target Date Range
              </label>
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  label="Next 4 Weeks"
                  @click="setPresetWeeks(4)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  label="Full Term (15 Wks)"
                  @click="setPresetWeeks(15)"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <BaseFormInput
                v-model="weeklyStartDate"
                name="weeklyStartDate"
                label="Start Date"
                type="date"
              />
              <BaseFormInput
                v-model="weeklyEndDate"
                name="weeklyEndDate"
                label="End Date"
                type="date"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showWeeklyModal = false"
          />
          <UButton
            color="primary"
            icon="i-lucide-calendar-plus"
            label="Generate &amp; Publish Shifts"
            :loading="isGeneratingShifts"
            :disabled="
              !weeklyProctorId || !weeklyStartDate || !weeklyEndDate || weeklySlots.length === 0
            "
            @click="handleBatchGenerate"
          />
        </div>
      </template>
    </UModal>

    <!-- Modal: Edit Single Shift -->
    <UModal v-model:open="showEditShiftModal" title="Edit Proctor Shift">
      <template #body>
        <div class="space-y-4">
          <p class="text-xs text-neutral-500">
            Adjust times or reassign proctor for this specific shift slot.
          </p>

          <UFormField label="Proctor" required>
            <USelect
              v-model="editShiftForm.userId"
              :items="proctorOptions.filter((o) => o.value !== ADD_PROCTOR_VALUE)"
              placeholder="Select proctor..."
              class="w-full"
            />
          </UFormField>

          <BaseFormInput
            v-model="editShiftForm.startTime"
            name="editStartTime"
            label="Shift Start Time"
            type="datetime-local"
          />
          <BaseFormInput
            v-model="editShiftForm.endTime"
            name="editEndTime"
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
            @click="showEditShiftModal = false"
          />
          <UButton
            color="primary"
            label="Save Changes"
            :loading="isUpdatingShift"
            :disabled="!editShiftForm.userId || !editShiftForm.startTime || !editShiftForm.endTime"
            @click="handleUpdateShift"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useCbtfAdmin } from '~/composables/features/admin/useCbtfAdmin'
import {
  parseProctorShiftString,
  calculateWeeklyShiftHours,
  formatTimeStr12h,
  formatShiftDuration,
  formatShiftDate,
  type ParsedShiftSlot
} from '@@/shared/utils/proctor-schedule-parser'

definePageMeta({
  middleware: ['admin-only']
})

const {
  facility,
  shifts,
  reservations,
  refreshReservations,
  proctors,
  searchUserByEmail,
  grantProctorRole,
  saveFacility,
  upsertOperatingHours,
  deleteOperatingHours,
  createException,
  deleteException,
  createShift,
  deleteShift,
  batchGenerateShifts,
  updateShift,
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
  seatAllocationOrderStr: '',
  checkInLeadMinutes: 5,
  checkInGraceMinutes: 15,
  timezone: 'America/New_York'
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
      facilityForm.checkInLeadMinutes = fac.checkInLeadMinutes ?? 5
      facilityForm.checkInGraceMinutes = fac.checkInGraceMinutes ?? 15
      facilityForm.timezone = fac.timezone || 'America/New_York'
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
      checkInLeadMinutes: facilityForm.checkInLeadMinutes,
      checkInGraceMinutes: facilityForm.checkInGraceMinutes,
      timezone: facilityForm.timezone,
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

const ADD_PROCTOR_VALUE = '__ADD_PROCTOR__'

const proctorOptions = computed(() => {
  const options = proctors.value.map((p: any) => ({
    label: `${p.firstName || ''} ${p.lastName || ''} (${p.email})`.trim(),
    value: p.id
  }))
  options.push({
    label: '+ Add New Proctor...',
    value: ADD_PROCTOR_VALUE
  })
  return options
})

const selectedProctorId = ref('')
const proctorSearchEmail = ref('')
const isSearchingProctor = ref(false)
const isGrantingRole = ref(false)
const proctorSearchError = ref('')
const foundUser = ref<any | null>(null)

watch(selectedProctorId, (val) => {
  if (val && val !== ADD_PROCTOR_VALUE) {
    shiftForm.userId = val
  } else if (val === ADD_PROCTOR_VALUE) {
    shiftForm.userId = ''
  }
})

const resetProctorSearch = () => {
  proctorSearchEmail.value = ''
  proctorSearchError.value = ''
  foundUser.value = null
  isSearchingProctor.value = false
  isGrantingRole.value = false
}

const openShiftModal = () => {
  selectedProctorId.value = ''
  shiftForm.userId = ''
  shiftForm.startTime = ''
  shiftForm.endTime = ''
  resetProctorSearch()
  showShiftModal.value = true
}

watch(showShiftModal, (open) => {
  if (!open) {
    resetProctorSearch()
  }
})

const handleSearchProctor = async () => {
  if (!proctorSearchEmail.value.trim()) return
  proctorSearchError.value = ''
  foundUser.value = null
  isSearchingProctor.value = true
  try {
    const user = await searchUserByEmail(proctorSearchEmail.value.trim())
    foundUser.value = user
  } catch (err: any) {
    proctorSearchError.value =
      err.data?.statusMessage || err.data?.message || 'No user found with that email address.'
  } finally {
    isSearchingProctor.value = false
  }
}

const handleSelectFoundProctor = () => {
  if (!foundUser.value) return
  selectedProctorId.value = foundUser.value.id
  shiftForm.userId = foundUser.value.id
  resetProctorSearch()
}

const handleConfirmGrantProctor = async () => {
  if (!foundUser.value) return
  isGrantingRole.value = true
  try {
    const updated = await grantProctorRole(foundUser.value.id)
    selectedProctorId.value = updated.id
    shiftForm.userId = updated.id
    resetProctorSearch()
  } catch {
    // Error handled in composable toast
  } finally {
    isGrantingRole.value = false
  }
}

const shiftColumns: any[] = [
  {
    accessorKey: 'proctor',
    header: 'Proctor',
    cell: ({ row }: { row: any }) =>
      `${row.original.user?.firstName || ''} ${row.original.user?.lastName || ''} (${row.original.user?.email || '—'})`
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }: { row: any }) => formatShiftDate(row.original.date)
  },
  {
    accessorKey: 'hours',
    header: 'Shift Hours',
    cell: ({ row }: { row: any }) => {
      const dur = formatShiftDuration(row.original.startTime, row.original.endTime)
      return `${formatTimeStr12h(row.original.startTime)} – ${formatTimeStr12h(row.original.endTime)}${dur ? ` (${dur})` : ''}`
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: any }) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(resolveComponent('UButton'), {
          color: 'neutral',
          variant: 'ghost',
          size: 'xs',
          icon: 'i-lucide-pencil',
          title: 'Edit Shift',
          onClick: () => openEditShiftModal(row.original)
        }),
        h(resolveComponent('UButton'), {
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          icon: 'i-lucide-trash-2',
          title: 'Delete Shift',
          onClick: () => {
            if (confirm('Delete this proctor shift?')) {
              deleteShift(row.original.id)
            }
          }
        })
      ])
  }
]

const handleSaveShift = async () => {
  if (!shiftForm.userId || !shiftForm.startTime || !shiftForm.endTime) return
  await createShift({
    userId: shiftForm.userId,
    startTime: `${shiftForm.startTime}:00.000Z`,
    endTime: `${shiftForm.endTime}:00.000Z`
  })
  showShiftModal.value = false
  selectedProctorId.value = ''
  shiftForm.userId = ''
  shiftForm.startTime = ''
  shiftForm.endTime = ''
  resetProctorSearch()
}

// --- Weekly Schedule Builder State ---
const showWeeklyModal = ref(false)
const weeklyProctorId = ref('')
const weeklyRawText = ref('')
const weeklySlots = ref<ParsedShiftSlot[]>([])
const weeklyStartDate = ref('')
const weeklyEndDate = ref('')
const isGeneratingShifts = ref(false)

const weeklyTotalHours = computed(() => calculateWeeklyShiftHours(weeklySlots.value))

const calculateSlotDuration = (start: string, end: string) => {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const dur = (eh * 60 + em - (sh * 60 + sm)) / 60
  return Math.round((dur > 0 ? dur : 0) * 10) / 10
}

const handleWeeklyTextChange = () => {
  if (!weeklyRawText.value.trim()) return
  const parsed = parseProctorShiftString(weeklyRawText.value)
  if (parsed.length > 0) {
    weeklySlots.value = parsed
  }
}

const addWeeklySlot = () => {
  weeklySlots.value.push({
    dayOfWeek: 1,
    dayName: 'Monday',
    startTime: '09:00',
    endTime: '12:00',
    durationHours: 3.0
  })
}

const removeWeeklySlot = (index: number) => {
  weeklySlots.value.splice(index, 1)
}

const setPresetWeeks = (weeks: number) => {
  const today = new Date()
  const day = today.getDay()
  const diffToMon = day === 1 ? 0 : (8 - day) % 7
  const start = new Date(today)
  start.setDate(today.getDate() + diffToMon)

  const end = new Date(start)
  end.setDate(start.getDate() + weeks * 7 - 3) // Friday of that week

  const pad = (n: number) => String(n).padStart(2, '0')
  weeklyStartDate.value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  weeklyEndDate.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
}

const openWeeklyScheduleModal = () => {
  weeklyProctorId.value = ''
  weeklyRawText.value = ''
  weeklySlots.value = []
  setPresetWeeks(4)
  showWeeklyModal.value = true
}

const handleBatchGenerate = async () => {
  if (
    !weeklyProctorId.value ||
    !weeklyStartDate.value ||
    !weeklyEndDate.value ||
    weeklySlots.value.length === 0
  )
    return
  isGeneratingShifts.value = true
  try {
    await batchGenerateShifts({
      userId: weeklyProctorId.value,
      startDate: weeklyStartDate.value,
      endDate: weeklyEndDate.value,
      shifts: weeklySlots.value.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    })
    showWeeklyModal.value = false
  } finally {
    isGeneratingShifts.value = false
  }
}

// --- Edit Single Shift State ---
const showEditShiftModal = ref(false)
const editingShiftId = ref('')
const editShiftForm = reactive({
  userId: '',
  startTime: '',
  endTime: ''
})
const isUpdatingShift = ref(false)

const toDateTimeLocalValue = (dateVal: string | Date, timeStr: string) => {
  if (!dateVal || !timeStr) return ''
  const dateStr =
    typeof dateVal === 'string'
      ? dateVal.split('T')[0]
      : dateVal.toISOString().split('T')[0]
  if (!dateStr) return ''
  return `${dateStr}T${timeStr}`
}

const openEditShiftModal = (shift: any) => {
  editingShiftId.value = shift.id
  editShiftForm.userId = shift.userId || shift.user?.id || ''
  editShiftForm.startTime = toDateTimeLocalValue(shift.date, shift.startTime)
  editShiftForm.endTime = toDateTimeLocalValue(shift.date, shift.endTime)
  showEditShiftModal.value = true
}

const handleUpdateShift = async () => {
  if (!editingShiftId.value || !editShiftForm.startTime || !editShiftForm.endTime) return
  isUpdatingShift.value = true
  try {
    await updateShift(editingShiftId.value, {
      userId: editShiftForm.userId || undefined,
      startTime: `${editShiftForm.startTime}:00.000Z`,
      endTime: `${editShiftForm.endTime}:00.000Z`
    })
    showEditShiftModal.value = false
  } finally {
    isUpdatingShift.value = false
  }
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
