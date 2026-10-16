import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, h } from 'vue'
import CbtfAdminPage from '~/pages/admin/cbtf.vue'

const mockBatchGenerateShifts = vi.fn().mockResolvedValue({ count: 3, shifts: [] })
const mockSaveProctorShiftDefinition = vi
  .fn()
  .mockResolvedValue({ id: 'p1', proctorShiftDefinition: '' })
const mockCreateShift = vi.fn()
const mockDeleteShift = vi.fn()
const mockUpdateShift = vi.fn()
const mockRefreshShifts = vi.fn()

const mockProctors = ref([
  {
    id: 'p1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@vt.edu',
    globalRole: 'PROCTOR',
    avatarUrl: null,
    proctorShiftDefinition:
      'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
  },
  {
    id: 'p2',
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob@vt.edu',
    globalRole: 'PROCTOR',
    avatarUrl: null,
    proctorShiftDefinition: null
  }
])

const mockFacility = ref({
  id: 'fac-1',
  name: 'Main CBTF Facility',
  totalSeats: 32,
  seatAllocationOrder: [1, 2, 3],
  operatingHours: [],
  scheduleExceptions: []
})

const mockShifts = ref([
  {
    id: 'shift-1',
    facilityId: 'fac-1',
    userId: 'p1',
    date: '2026-09-15T00:00:00.000Z',
    startTime: '14:00',
    endTime: '17:00',
    user: {
      id: 'p1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@vt.edu',
      avatarUrl: null
    }
  }
])

const mockReservations = ref([])

vi.mock('~/composables/features/admin/useCbtfAdmin', () => ({
  useCbtfAdmin: () => ({
    facility: mockFacility,
    facilityStatus: ref('success'),
    refreshFacility: vi.fn(),
    shifts: mockShifts,
    shiftsStatus: ref('success'),
    refreshShifts: mockRefreshShifts,
    reservations: mockReservations,
    reservationsStatus: ref('success'),
    refreshReservations: vi.fn(),
    proctors: mockProctors,
    proctorsStatus: ref('success'),
    refreshProctors: vi.fn(),
    searchUserByEmail: vi.fn(),
    grantProctorRole: vi.fn(),
    saveFacility: vi.fn(),
    upsertOperatingHours: vi.fn(),
    deleteOperatingHours: vi.fn(),
    createException: vi.fn(),
    updateException: vi.fn(),
    deleteException: vi.fn(),
    createShift: mockCreateShift,
    deleteShift: mockDeleteShift,
    batchGenerateShifts: mockBatchGenerateShifts,
    saveProctorShiftDefinition: mockSaveProctorShiftDefinition,
    updateShift: mockUpdateShift,
    updateReservation: vi.fn()
  })
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('h', h)
vi.stubGlobal('resolveComponent', (name: string) => name)

describe('CBTF Admin Proctor Weekly Schedule Builder', () => {
  const stubs = {
    BasePageHeader: {
      template: '<div><slot name="action" /></div>'
    },
    BaseCard: {
      template: '<div><slot /></div>'
    },
    BaseDataTable: {
      template: '<div data-testid="data-table"><slot /></div>'
    },
    UModal: {
      props: ['open'],
      template:
        '<div v-if="open" data-testid="modal"><slot /><slot name="body" /><slot name="footer" /></div>'
    },
    UButton: {
      props: ['label', 'disabled', 'loading'],
      template: '<button :disabled="disabled"><slot />{{ label }}</button>'
    },
    USelect: {
      props: ['modelValue', 'items'],
      emits: ['update:modelValue'],
      template:
        '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>'
    },
    UInput: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    UTextarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    UFormField: {
      template: '<div><slot /></div>'
    },
    UBadge: {
      template: '<span><slot /></span>'
    },
    UIcon: true,
    UTooltip: {
      template: '<div><slot /></div>'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  it('auto-populates raw text and weeklySlots when opening modal with a proctor having stored definition', async () => {
    const wrapper = mount(CbtfAdminPage, {
      global: { stubs }
    })

    // Switch to shifts tab so that proctor shift schedule controls are visible
    wrapper.vm.activeTab = 'shifts'
    await wrapper.vm.$nextTick()

    // Click Weekly Schedule Builder button
    const openBtn = wrapper.find('[data-label="Weekly Schedule Builder"]')
    expect(openBtn.exists()).toBe(true)
    await openBtn.trigger('click')

    // Modal is open
    expect(wrapper.vm.showWeeklyModal).toBe(true)

    // Initial proctor is p1 (Alice Smith) which has stored definition
    expect(wrapper.vm.weeklyProctorId).toBe('p1')

    // Check textarea value
    const textarea = wrapper.find('[data-testid="weekly-raw-textarea"]')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
    )

    // Check that 3 slots were parsed into the weekly slots list
    expect(wrapper.vm.weeklySlots).toHaveLength(3)
    expect(wrapper.vm.weeklySlots[0].dayOfWeek).toBe(2) // Tuesday
    expect(wrapper.vm.weeklySlots[0].startTime).toBe('14:00')
    expect(wrapper.vm.weeklySlots[0].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[1].dayOfWeek).toBe(3) // Wednesday
    expect(wrapper.vm.weeklySlots[1].startTime).toBe('14:30')
    expect(wrapper.vm.weeklySlots[1].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[2].dayOfWeek).toBe(4) // Thursday
    expect(wrapper.vm.weeklySlots[2].startTime).toBe('14:30')
    expect(wrapper.vm.weeklySlots[2].endTime).toBe('17:00')
  })

  it('clears raw text and slots when switching to a proctor without stored definition, and parses compact natural text format', async () => {
    const wrapper = mount(CbtfAdminPage, {
      global: { stubs }
    })

    wrapper.vm.openWeeklyScheduleModal()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklyProctorId).toBe('p1')
    expect(wrapper.vm.weeklySlots).toHaveLength(3)

    // Switch selected proctor to p2 (Bob Jones, has null definition)
    wrapper.vm.weeklyProctorId = 'p2'
    await wrapper.vm.$nextTick()

    // Slots and text should be cleared for p2
    expect(wrapper.vm.weeklyRawText).toBe('')
    expect(wrapper.vm.weeklySlots).toHaveLength(0)

    // Fast text entry for p2: Enter compact format without spaces before AM/PM
    wrapper.vm.weeklyRawText = 'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM'
    wrapper.vm.handleWeeklyTextChange()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklySlots).toHaveLength(3)
    expect(wrapper.vm.weeklySlots[0].dayOfWeek).toBe(1) // Monday
    expect(wrapper.vm.weeklySlots[0].startTime).toBe('14:00')
    expect(wrapper.vm.weeklySlots[0].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[1].dayOfWeek).toBe(3) // Wednesday
    expect(wrapper.vm.weeklySlots[1].startTime).toBe('09:00')
    expect(wrapper.vm.weeklySlots[1].endTime).toBe('11:30')
    expect(wrapper.vm.weeklySlots[2].dayOfWeek).toBe(5) // Friday
    expect(wrapper.vm.weeklySlots[2].startTime).toBe('09:00')
    expect(wrapper.vm.weeklySlots[2].endTime).toBe('11:30')

    // Generate batch shifts
    wrapper.vm.weeklyStartDate = '2026-09-14'
    wrapper.vm.weeklyEndDate = '2026-09-20'
    await wrapper.vm.handleBatchGenerate()

    expect(mockBatchGenerateShifts).toHaveBeenCalledWith({
      userId: 'p2',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      shiftDefinition: 'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM',
      shifts: [
        { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '11:30' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '11:30' }
      ]
    })

    // Expect definition to be cached on p2 and localStorage
    expect(mockProctors.value.find((p) => p.id === 'p2')?.proctorShiftDefinition).toBe(
      'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM'
    )
    expect(window.localStorage.getItem('cbtf-proctor-shift-def:p2')).toBe(
      'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM'
    )
  })

  it('auto-populates from localStorage cache when user definition is not in memory', async () => {
    // Reset p2 definition to null but set localStorage
    const p2 = mockProctors.value.find((p) => p.id === 'p2')
    if (p2) p2.proctorShiftDefinition = null
    window.localStorage.setItem(
      'cbtf-proctor-shift-def:p2',
      'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
    )

    const wrapper = mount(CbtfAdminPage, {
      global: { stubs }
    })

    wrapper.vm.openWeeklyScheduleModal()
    await wrapper.vm.$nextTick()

    // Switch to p2
    wrapper.vm.weeklyProctorId = 'p2'
    await wrapper.vm.$nextTick()

    // Should auto-populate from localStorage
    expect(wrapper.vm.weeklyRawText).toBe(
      'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
    )
    expect(wrapper.vm.weeklySlots).toHaveLength(3)
  })

  it('syncs weeklyRawText when slots are added or removed manually', async () => {
    const wrapper = mount(CbtfAdminPage, {
      global: { stubs }
    })

    wrapper.vm.openWeeklyScheduleModal()
    await wrapper.vm.$nextTick()

    // Switch to p2 and clear
    const p2 = mockProctors.value.find((p) => p.id === 'p2')
    if (p2) p2.proctorShiftDefinition = null
    window.localStorage.clear()

    wrapper.vm.weeklyProctorId = 'p2'
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklySlots).toHaveLength(0)
    expect(wrapper.vm.weeklyRawText).toBe('')

    // Add slot
    wrapper.vm.addWeeklySlot()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklySlots).toHaveLength(1)
    expect(wrapper.vm.weeklyRawText).toContain('Mon 9:00 AM–12:00 PM (3.0h)')

    // Remove slot
    wrapper.vm.removeWeeklySlot(0)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklySlots).toHaveLength(0)
    expect(wrapper.vm.weeklyRawText).toBe('')
  })
})
