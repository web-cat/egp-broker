<template>
  <div class="space-y-4 pt-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
      <div>
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UIcon name="i-lucide-user-check" class="w-5 h-5 text-primary-500" />
          GTA Interviews &amp; Shifts
        </h3>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Configure interview meeting location and manage weekly shifts for Graduate Teaching Assistants.
        </p>
      </div>
      <div class="flex items-center flex-wrap gap-2">
        <UButton
          to="/interviews"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-external-link"
          label="Interview Console"
        />
        <UButton
          color="primary"
          variant="subtle"
          size="sm"
          icon="i-lucide-calendar-days"
          label="Weekly Schedule Builder"
          @click="openWeeklyModal"
        />
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-plus"
          label="Add Shift"
          @click="openAddShiftModal"
        />
      </div>
    </div>

    <!-- Location Card / Quick Config -->
    <div
      class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 mt-0.5 sm:mt-0">
          <UIcon name="i-lucide-map-pin" class="w-5 h-5" />
        </div>
        <div class="space-y-0.5">
          <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            GTA Interview Location
          </span>
          <div v-if="!isEditingLocation" class="flex items-center gap-2">
            <p v-if="interviewLocation" class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {{ interviewLocation }}
            </p>
            <p v-else class="text-xs italic text-neutral-400 dark:text-neutral-500">
              No specific location set — students will see a default location notice.
            </p>
          </div>
          <div v-else class="flex items-center gap-2 pt-1">
            <UInput
              v-model="localLocation"
              data-testid="location-input"
              size="xs"
              placeholder="e.g., McBryde 106 or Zoom Link"
              class="w-64 sm:w-80"
            />
            <UButton
              data-testid="save-location-btn"
              size="xs"
              color="primary"
              label="Save"
              :loading="isSavingLocation"
              @click="handleSaveLocation"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              label="Cancel"
              @click="cancelEditLocation"
            />
          </div>
        </div>
      </div>

      <div v-if="!isEditingLocation">
        <UButton
          data-testid="edit-location-btn"
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-pencil"
          label="Change Location"
          @click="startEditLocation"
        />
      </div>
    </div>

    <!-- Shifts Table Controls & Filters -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
      <div class="flex items-center gap-2">
        <span class="text-xs text-neutral-500">Filter by GTA:</span>
        <USelect
          v-model="selectedGtaFilter"
          :items="gtaFilterOptions"
          class="w-48 text-xs"
        />
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="shiftsStatus === 'pending'"
          @click="() => refreshShifts()"
        />
      </div>
    </div>

    <!-- Shifts BaseDataTable -->
    <BaseDataTable
      :data="filteredShifts"
      :columns="shiftColumns"
      :loading="shiftsStatus === 'pending'"
      searchable
      search-placeholder="Search shifts by GTA name or email…"
      empty-icon="i-lucide-calendar-x"
      empty-text="No GTA shifts scheduled yet. Use the Weekly Schedule Builder or Add Shift."
    />

    <!-- Modal: Weekly Schedule Builder -->
    <UModal v-model:open="showWeeklyModal" title="Weekly Schedule Builder for GTAs">
      <template #body>
        <div class="space-y-4">
          <p class="text-xs text-neutral-500">
            Paste a weekly shift availability block for a Graduate TA. The parser will automatically generate recurring dates within your target window.
          </p>

          <!-- Select Target GTA -->
          <UFormField label="Select Graduate TA" required>
            <USelect
              v-model="weeklyGtaId"
              :items="gtaSelectOptions"
              placeholder="Choose a Teaching Assistant..."
              class="w-full"
            />
          </UFormField>

          <!-- Weekly Schedule Text Input -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Weekly Schedule (Text)
              </label>
              <span class="text-xs text-neutral-400">e.g. MWF 10:00-11:00 or T 14:00-16:00</span>
            </div>
            <UTextarea
              v-model="weeklyRawText"
              placeholder="e.g.&#10;MWF 10:00-11:00&#10;TR 14:00-15:30"
              :rows="3"
              class="w-full font-mono text-xs"
            />
            <div class="flex justify-end pt-1">
              <UButton
                size="xs"
                variant="subtle"
                color="primary"
                icon="i-lucide-wand-2"
                label="Parse Schedule"
                :disabled="!weeklyRawText.trim()"
                @click="handleParseWeeklyText"
              />
            </div>
          </div>

          <!-- Interactive Slot Editor -->
          <div class="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Configured Weekly Slots
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
                No slots configured yet. Paste shift text above or click "+ Add Slot" to build manually.
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

          <!-- Target Date Range -->
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
        <div class="flex justify-end gap-2 w-full">
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
            :disabled="!weeklyGtaId || !weeklyStartDate || !weeklyEndDate || weeklySlots.length === 0"
            @click="handleBatchGenerate"
          />
        </div>
      </template>
    </UModal>

    <!-- Modal: Add Single Shift -->
    <UModal v-model:open="showAddShiftModal" title="Schedule Single GTA Shift">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Select Graduate TA" required>
            <USelect
              v-model="singleShiftForm.userId"
              :items="gtaSelectOptions"
              placeholder="Choose GTA..."
              class="w-full"
            />
          </UFormField>
          <BaseFormInput
            v-model="singleShiftForm.date"
            name="shiftDate"
            label="Shift Date"
            type="date"
            required
          />
          <div class="grid grid-cols-2 gap-3">
            <BaseFormInput
              v-model="singleShiftForm.startTime"
              name="startTime"
              label="Start Time (HH:mm)"
              type="time"
              required
            />
            <BaseFormInput
              v-model="singleShiftForm.endTime"
              name="endTime"
              label="End Time (HH:mm)"
              type="time"
              required
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showAddShiftModal = false"
          />
          <UButton
            color="primary"
            icon="i-lucide-check"
            label="Create Shift"
            :loading="isSavingSingleShift"
            :disabled="!singleShiftForm.userId || !singleShiftForm.date || !singleShiftForm.startTime || !singleShiftForm.endTime"
            @click="handleCreateSingleShift"
          />
        </div>
      </template>
    </UModal>

    <!-- Modal: Edit Single Shift -->
    <UModal v-model:open="showEditShiftModal" title="Edit GTA Shift">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Graduate TA" required>
            <USelect
              v-model="editShiftForm.userId"
              :items="gtaSelectOptions"
              placeholder="Reassign GTA..."
              class="w-full"
            />
          </UFormField>
          <BaseFormInput
            v-model="editShiftForm.date"
            name="editDate"
            label="Shift Date"
            type="date"
            required
          />
          <div class="grid grid-cols-2 gap-3">
            <BaseFormInput
              v-model="editShiftForm.startTime"
              name="editStartTime"
              label="Start Time (HH:mm)"
              type="time"
              required
            />
            <BaseFormInput
              v-model="editShiftForm.endTime"
              name="editEndTime"
              label="End Time (HH:mm)"
              type="time"
              required
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showEditShiftModal = false"
          />
          <UButton
            color="primary"
            icon="i-lucide-check"
            label="Save Changes"
            :loading="isUpdatingShift"
            :disabled="!editShiftForm.date || !editShiftForm.startTime || !editShiftForm.endTime"
            @click="handleUpdateShift"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, h, resolveComponent } from 'vue'
import {
  useTeacherGtaShifts,
  type GtaShiftItem
} from '~/composables/features/useTeacherGtaShifts'
import {
  parseProctorShiftString,
  calculateWeeklyShiftHours,
  formatTimeStr12h,
  formatShiftDuration,
  formatShiftDate,
  type ParsedShiftSlot
} from '@@/shared/utils/proctor-schedule-parser'

const props = defineProps<{
  courseId: string
  interviewLocation?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:location', loc: string | null): void
}>()

const {
  shifts,
  shiftsStatus,
  gtas,
  refreshShifts,
  createShift,
  updateShift,
  deleteShift,
  batchGenerateShifts,
  updateInterviewLocation
} = useTeacherGtaShifts(computed(() => props.courseId))

// --- Location Management ---
const localLocation = ref(props.interviewLocation ?? '')
const isEditingLocation = ref(false)
const isSavingLocation = ref(false)

watch(
  () => props.interviewLocation,
  (loc) => {
    localLocation.value = loc ?? ''
  }
)

const startEditLocation = () => {
  localLocation.value = props.interviewLocation ?? ''
  isEditingLocation.value = true
}

const cancelEditLocation = () => {
  localLocation.value = props.interviewLocation ?? ''
  isEditingLocation.value = false
}

const handleSaveLocation = async () => {
  isSavingLocation.value = true
  try {
    const updated = await updateInterviewLocation(localLocation.value)
    emit('update:location', updated)
    isEditingLocation.value = false
  } finally {
    isSavingLocation.value = false
  }
}

// --- GTA Dropdown Options ---
const gtaSelectOptions = computed(() => {
  return gtas.value.map((g) => ({
    label: `${g.firstName || ''} ${g.lastName || ''} (${g.email})`.trim(),
    value: g.id
  }))
})

const gtaFilterOptions = computed(() => {
  return [
    { label: 'All GTAs', value: 'all' },
    ...gtaSelectOptions.value
  ]
})

const selectedGtaFilter = ref('all')

const filteredShifts = computed(() => {
  if (selectedGtaFilter.value === 'all') return shifts.value
  return shifts.value.filter((s) => s.userId === selectedGtaFilter.value)
})

// --- Day of Week Options ---
const dayOfWeekOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 }
]

// --- Weekly Schedule Builder State ---
const showWeeklyModal = ref(false)
const weeklyGtaId = ref('')
const weeklyRawText = ref('')
const weeklySlots = ref<ParsedShiftSlot[]>([])
const weeklyStartDate = ref('')
const weeklyEndDate = ref('')
const isGeneratingShifts = ref(false)

const openWeeklyModal = () => {
  weeklyGtaId.value = gtas.value[0]?.id || ''
  weeklyRawText.value = ''
  weeklySlots.value = []
  setPresetWeeks(4)
  showWeeklyModal.value = true
}

const handleParseWeeklyText = () => {
  const parsed = parseProctorShiftString(weeklyRawText.value)
  if (parsed.length > 0) {
    weeklySlots.value = parsed
  }
}

const weeklyTotalHours = computed(() => {
  return calculateWeeklyShiftHours(weeklySlots.value)
})

const addWeeklySlot = () => {
  weeklySlots.value.push({
    dayOfWeek: 1,
    dayName: 'Monday',
    startTime: '10:00',
    endTime: '12:00',
    durationHours: 2.0
  })
}

const removeWeeklySlot = (idx: number) => {
  weeklySlots.value.splice(idx, 1)
}

const calculateSlotDuration = (start: string, end: string) => {
  return formatShiftDuration(start, end)
}

const setPresetWeeks = (weeks: number) => {
  const now = new Date()
  const start = now.toISOString().split('T')[0]
  const endD = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
  const end = endD.toISOString().split('T')[0]
  weeklyStartDate.value = start || ''
  weeklyEndDate.value = end || ''
}

const handleBatchGenerate = async () => {
  if (!weeklyGtaId.value || !weeklyStartDate.value || !weeklyEndDate.value || weeklySlots.value.length === 0)
    return
  isGeneratingShifts.value = true
  try {
    await batchGenerateShifts({
      userId: weeklyGtaId.value,
      startDate: weeklyStartDate.value,
      endDate: weeklyEndDate.value,
      shifts: weeklySlots.value.map((s) => ({
        dayOfWeek: Number(s.dayOfWeek),
        startTime: s.startTime,
        endTime: s.endTime
      }))
    })
    showWeeklyModal.value = false
  } finally {
    isGeneratingShifts.value = false
  }
}

// --- Single Shift Add State ---
const showAddShiftModal = ref(false)
const isSavingSingleShift = ref(false)
const singleShiftForm = reactive({
  userId: '',
  date: '',
  startTime: '10:00',
  endTime: '12:00'
})

const openAddShiftModal = () => {
  singleShiftForm.userId = gtas.value[0]?.id || ''
  singleShiftForm.date = new Date().toISOString().split('T')[0] || ''
  singleShiftForm.startTime = '10:00'
  singleShiftForm.endTime = '12:00'
  showAddShiftModal.value = true
}

const handleCreateSingleShift = async () => {
  if (!singleShiftForm.userId || !singleShiftForm.date || !singleShiftForm.startTime || !singleShiftForm.endTime)
    return
  isSavingSingleShift.value = true
  try {
    await createShift({
      userId: singleShiftForm.userId,
      date: singleShiftForm.date,
      startTime: singleShiftForm.startTime,
      endTime: singleShiftForm.endTime
    })
    showAddShiftModal.value = false
  } finally {
    isSavingSingleShift.value = false
  }
}

// --- Edit Single Shift State ---
const showEditShiftModal = ref(false)
const editingShiftId = ref('')
const isUpdatingShift = ref(false)
const editShiftForm = reactive({
  userId: '',
  date: '',
  startTime: '',
  endTime: ''
})

const openEditShiftModal = (shift: GtaShiftItem) => {
  editingShiftId.value = shift.id
  editShiftForm.userId = shift.userId || shift.user?.id || ''
  const dateStr = typeof shift.date === 'string' ? shift.date.split('T')[0] : ''
  editShiftForm.date = dateStr || ''
  editShiftForm.startTime = shift.startTime
  editShiftForm.endTime = shift.endTime
  showEditShiftModal.value = true
}

const handleUpdateShift = async () => {
  if (!editingShiftId.value || !editShiftForm.date || !editShiftForm.startTime || !editShiftForm.endTime)
    return
  isUpdatingShift.value = true
  try {
    await updateShift(editingShiftId.value, {
      userId: editShiftForm.userId || undefined,
      date: editShiftForm.date,
      startTime: editShiftForm.startTime,
      endTime: editShiftForm.endTime
    })
    showEditShiftModal.value = false
  } finally {
    isUpdatingShift.value = false
  }
}

// --- Shift Columns ---
const shiftColumns = [
  {
    accessorKey: 'user',
    header: 'Graduate TA',
    cell: ({ row }: { row: { original: GtaShiftItem } }) => {
      const user = row.original.user
      const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unknown TA'
      return h('div', { class: 'flex items-center gap-3' }, [
        h(
          'div',
          {
            class:
              'w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-xs'
          },
          user?.firstName?.[0] || 'T'
        ),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate' }, name),
          h('p', { class: 'text-xs text-neutral-500 truncate' }, user?.email || '')
        ])
      ])
    }
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }: { row: { original: GtaShiftItem } }) => formatShiftDate(row.original.date)
  },
  {
    accessorKey: 'hours',
    header: 'Shift Hours',
    cell: ({ row }: { row: { original: GtaShiftItem } }) => {
      const dur = formatShiftDuration(row.original.startTime, row.original.endTime)
      return `${formatTimeStr12h(row.original.startTime)} – ${formatTimeStr12h(row.original.endTime)}${dur ? ` (${dur})` : ''}`
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: { original: GtaShiftItem } }) =>
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
            if (confirm('Are you sure you want to delete this GTA shift?')) {
              deleteShift(row.original.id)
            }
          }
        })
      ])
  }
]
</script>
