import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, unref } from 'vue'
import GtaInterviewConsole from '~/components/features/gta/GtaInterviewConsole.vue'
import { combineDateAndTime, DEFAULT_GTA_TIMEZONE } from '@@/shared/utils/timezone'

const mockUser = ref<any>({
  id: 'gta-current',
  email: 'gta@vt.edu',
  globalRole: 'USER'
})

vi.stubGlobal('useUserSession', () => ({
  user: mockUser
}))

const mockCourseGtas = ref<any[]>([
  { id: 'gta-current', firstName: 'Current', lastName: 'GTA' },
  { id: 'gta-other', firstName: 'Other', lastName: 'GTA' }
])

const mockCourseShifts = ref<any[]>([])

vi.stubGlobal('useFetch', (urlRef: any) => {
  const url = typeof urlRef === 'function' ? urlRef() : unref(urlRef)
  if (url && String(url).includes('gtas')) {
    return { data: ref({ data: mockCourseGtas.value }) }
  }
  if (url && String(url).includes('gta-shifts')) {
    return { data: ref({ data: mockCourseShifts.value }) }
  }
  return { data: ref({ data: [] }) }
})

const mockActiveInterview = ref<any>(null)
const mockExpectedArrivals = ref<any[]>([])
const mockCompletedList = ref<any[]>([])
const mockFeedStatus = ref('idle')
const mockIsUpdating = ref(false)

const mockRefreshFeed = vi.fn()
const mockCheckIn = vi.fn()
const mockCancelCheckIn = vi.fn()
const mockCheckOut = vi.fn()
const mockUpdateInterview = vi.fn()
const mockSaveNotes = vi.fn()
const mockMarkNoShow = vi.fn()
const mockReinstateReservation = vi.fn()

vi.mock('~/composables/features/useGtaInterviewConsole', () => ({
  useGtaInterviewConsole: () => ({
    activeInterview: mockActiveInterview,
    expectedArrivals: mockExpectedArrivals,
    completedList: mockCompletedList,
    feedStatus: mockFeedStatus,
    isUpdating: mockIsUpdating,
    refreshFeed: mockRefreshFeed,
    checkIn: mockCheckIn,
    cancelCheckIn: mockCancelCheckIn,
    checkOut: mockCheckOut,
    updateInterview: mockUpdateInterview,
    saveNotes: mockSaveNotes,
    markNoShow: mockMarkNoShow,
    reinstateReservation: mockReinstateReservation
  })
}))

describe('GtaInterviewConsole Component', () => {
  const stubs = {
    UModal: {
      props: ['open', 'title'],
      template:
        '<div v-if="open"><h3>{{ title }}</h3><slot name="body" /><slot name="footer" /></div>'
    },
    UIcon: true,
    UBadge: {
      template: '<span><slot /></span>'
    },
    UButton: {
      props: ['label', 'disabled', 'loading', 'title'],
      template: '<button :disabled="disabled" :title="title"><slot />{{ label }}</button>'
    },
    UTextarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    UCard: {
      template: '<div><slot /></div>'
    },
    UInput: {
      props: ['modelValue', 'type', 'ariaLabel'],
      emits: ['update:modelValue'],
      template:
        '<input :type="type" :value="modelValue" :aria-label="ariaLabel" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    USelect: {
      props: ['modelValue', 'items', 'ariaLabel'],
      emits: ['update:modelValue'],
      template: `<select :value="modelValue" :aria-label="ariaLabel" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="item in items" :key="item.value || item" :value="item.value || item">{{ item.label || item }}</option>
      </select>`
    },
    UPagination: {
      props: ['page', 'itemsPerPage', 'total'],
      emits: ['update:page'],
      template:
        '<div data-testid="pagination-stub" :data-page="page" :data-total="total">Pagination</div>'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.value = {
      id: 'gta-current',
      email: 'gta@vt.edu',
      globalRole: 'USER'
    }
    mockCourseShifts.value = []
    mockActiveInterview.value = null
    mockExpectedArrivals.value = []
    mockCompletedList.value = []
  })

  it('renders header, course information, and interview location', () => {
    const wrapper = mount(GtaInterviewConsole, {
      props: {
        courseId: 'course-1',
        courseTitle: 'Software Design',
        courseCode: 'CS 2114',
        interviewLocation: 'McBryde 106'
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Graduate TA Interview Console')
    expect(wrapper.text()).toContain('CS 2114: Software Design')
    expect(wrapper.text()).toContain('McBryde 106')
  })

  it('renders active interview panel and handles save notes and checkout', async () => {
    mockActiveInterview.value = {
      id: 'res-active-1',
      status: 'CHECKED_IN',
      startTime: '2026-10-05T10:00:00.000Z',
      endTime: '2026-10-05T10:10:00.000Z',
      checkedInAt: '2026-10-05T10:00:05.000Z',
      notes: 'Initial observation',
      student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1: Memory Manager' }
    }

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Active Interview In Progress')
    expect(wrapper.text()).toContain('Alice Smith')
    expect(wrapper.text()).toContain('Project 1: Memory Manager')

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('Understands pointers well.')

    const buttons = wrapper.findAll('button')
    const saveNotesBtn = buttons.find((b) => b.text().includes('Save Notes'))
    expect(saveNotesBtn).toBeDefined()
    await saveNotesBtn!.trigger('click')

    expect(mockUpdateInterview).toHaveBeenCalledWith('res-active-1', {
      notes: 'Understands pointers well.'
    })

    const checkoutBtn = buttons.find((b) => b.text().includes('Complete & Check Out'))
    expect(checkoutBtn).toBeDefined()
    await checkoutBtn!.trigger('click')

    expect(mockCheckOut).toHaveBeenCalledWith('res-active-1', 'Understands pointers well.')
  })

  it('renders expected arrivals list and performs check-in', async () => {
    mockExpectedArrivals.value = [
      {
        id: 'res-sched-1',
        status: 'SCHEDULED',
        startTime: '2026-10-05T10:10:00.000Z',
        endTime: '2026-10-05T10:20:00.000Z',
        student: { firstName: 'Bob', lastName: 'Jones', email: 'bob@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' },
        gtaId: 'gta-current'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Expected Arrivals')
    expect(wrapper.text()).toContain('Bob Jones')

    const buttons = wrapper.findAll('button')
    const checkInBtn = buttons.find((b) => b.text().includes('Check In'))
    expect(checkInBtn).toBeDefined()
    await checkInBtn!.trigger('click')

    expect(mockCheckIn).toHaveBeenCalledWith('res-sched-1')
  })

  it('handles marking student as no-show with modal confirmation', async () => {
    mockExpectedArrivals.value = [
      {
        id: 'res-sched-1',
        status: 'SCHEDULED',
        startTime: '2026-10-05T10:10:00.000Z',
        endTime: '2026-10-05T10:20:00.000Z',
        student: { firstName: 'Charlie', lastName: 'Brown', email: 'cbrown@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' },
        gtaId: 'gta-current'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    const noShowBtn = wrapper.findAll('button').find((b) => b.text().includes('No-Show'))
    expect(noShowBtn).toBeDefined()
    await noShowBtn!.trigger('click')

    expect(wrapper.text()).toContain('Mark Student as No-Show')
    expect(wrapper.text()).toContain('Charlie Brown')

    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('Confirm No-Show'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')

    expect(mockMarkNoShow).toHaveBeenCalledWith('res-sched-1')
  })

  it('renders completed appointments in history section with full wrapped notes and status default', async () => {
    mockCompletedList.value = [
      {
        id: 'res-done-1',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:40:00.000Z',
        endTime: '2026-10-05T09:50:00.000Z',
        notes:
          'Graded: full credit.\nClear and concise explanations given across all rubric criteria.',
        student: { firstName: 'Diana', lastName: 'Prince', email: 'diana@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' },
        gtaId: 'gta-current'
      },
      {
        id: 'res-missed-1',
        status: 'MISSED',
        startTime: '2026-10-05T09:30:00.000Z',
        endTime: '2026-10-05T09:40:00.000Z',
        notes: null,
        student: { firstName: 'Evan', lastName: 'Wright', email: 'evan@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' },
        gtaId: 'gta-current'
      },
      {
        id: 'res-cancel-1',
        status: 'CANCELLED',
        startTime: '2026-10-05T09:20:00.000Z',
        endTime: '2026-10-05T09:30:00.000Z',
        notes: 'Student rescheduled ahead of time.',
        student: { firstName: 'Fiona', lastName: 'Gallagher', email: 'fiona@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' },
        gtaId: 'gta-current'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Completed Interviews')
    // Defaults to COMPLETED: Diana is visible, Evan and Fiona are filtered out initially
    expect(wrapper.text()).toContain('Diana Prince')
    expect(wrapper.text()).not.toContain('Evan Wright')
    expect(wrapper.text()).not.toContain('Fiona Gallagher')

    // Verify notes column is wrapped and not truncated
    const notesCell = wrapper.findAll('td').find((td) => td.text().includes('Graded: full credit.'))
    expect(notesCell).toBeDefined()
    expect(notesCell!.classes()).toContain('whitespace-pre-wrap')
    expect(notesCell!.classes()).toContain('break-words')

    // Switch status filter to ALL to see missed and cancelled appointments
    const statusSelect = wrapper.find('select[aria-label="Filter completed by status"]')
    expect(statusSelect.exists()).toBe(true)
    await statusSelect.setValue('ALL')

    expect(wrapper.text()).toContain('Diana Prince')
    expect(wrapper.text()).toContain('Evan Wright')
    expect(wrapper.text()).toContain('Fiona Gallagher')
    expect(wrapper.text()).toContain('MISSED')
    expect(wrapper.text()).toContain('CANCELLED')
  })

  it('renders training mode banner and handles reset scenario', async () => {
    const mockResetScenario = vi.fn()
    const trainingState = {
      activeInterview: ref(null),
      expectedArrivals: ref([
        {
          id: 'train-1',
          status: 'SCHEDULED',
          startTime: '2026-10-05T10:00:00.000Z',
          endTime: '2026-10-05T10:10:00.000Z',
          student: { firstName: 'Maya', lastName: 'Lin', email: 'mlin@vt.edu' },
          assignment: { id: 'asg-1', title: 'Project 1' }
        }
      ]),
      completedList: ref([]),
      feedStatus: ref('success'),
      isUpdating: ref(false),
      refreshFeed: vi.fn(),
      checkIn: vi.fn(),
      cancelCheckIn: vi.fn(),
      checkOut: vi.fn(),
      updateInterview: mockUpdateInterview,
      saveNotes: vi.fn(),
      markNoShow: vi.fn(),
      reinstateReservation: vi.fn(),
      resetScenario: mockResetScenario
    }

    const wrapper = mount(GtaInterviewConsole, {
      props: {
        courseId: 'training-sandbox',
        courseTitle: 'Software Design (Training)',
        isTraining: true,
        trainingState
      },
      global: { stubs }
    })

    expect(wrapper.find('[data-testid="training-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('GRADUATE TA TRAINING SANDBOX')
    expect(wrapper.text()).toContain('In-Memory Mode')
    expect(wrapper.text()).toContain('TRAINING')
    expect(wrapper.text()).toContain('Maya Lin')

    const resetBtn = wrapper.find('[data-testid="reset-scenario-btn"]')
    expect(resetBtn.exists()).toBe(true)
    await resetBtn.trigger('click')

    expect(mockResetScenario).toHaveBeenCalled()
  })

  it('renders link to training mode when in live mode', () => {
    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1', isTraining: false },
      global: { stubs }
    })

    expect(wrapper.find('[data-testid="training-banner"]').exists()).toBe(false)
    const trainingBtn = wrapper.findAll('button').find((b) => b.text().includes('Training Mode'))
    expect(trainingBtn).toBeDefined()
  })

  it('opens cancel check-in modal and confirms cancellation', async () => {
    mockActiveInterview.value = {
      id: 'res-active-1',
      status: 'CHECKED_IN',
      startTime: '2026-10-05T10:00:00.000Z',
      endTime: '2026-10-05T10:10:00.000Z',
      student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' }
    }

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    const cancelCheckInBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Cancel Check-In'))
    expect(cancelCheckInBtn).toBeDefined()

    await cancelCheckInBtn!.trigger('click')

    expect(wrapper.text()).toContain('Cancel Check-In')
    const confirmBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Yes, Cancel Check-In'))
    expect(confirmBtn).toBeDefined()

    await confirmBtn!.trigger('click')
    expect(mockCancelCheckIn).toHaveBeenCalledWith('res-active-1')
  })

  it('reinstates a missed appointment from shift history', async () => {
    mockCompletedList.value = [
      {
        id: 'res-missed-1',
        status: 'MISSED',
        startTime: '2026-10-05T09:00:00.000Z',
        endTime: '2026-10-05T09:10:00.000Z',
        student: { firstName: 'Evan', lastName: 'Wright', email: 'evan@vt.edu' },
        assignment: { title: 'Project 1' },
        gtaId: 'gta-current'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    // To see MISSED appointments, set filter to MISSED or ALL
    const statusSelect = wrapper.find('select[aria-label="Filter completed by status"]')
    await statusSelect.setValue('MISSED')

    const reinstateBtn = wrapper.findAll('button').find((b) => b.text().includes('Reinstate'))
    expect(reinstateBtn).toBeDefined()

    await reinstateBtn!.trigger('click')
    expect(mockReinstateReservation).toHaveBeenCalledWith('res-missed-1')
  })

  it('opens edit modal and updates both notes and status for completed appointment', async () => {
    mockCompletedList.value = [
      {
        id: 'res-comp-1',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:30:00.000Z',
        endTime: '2026-10-05T09:40:00.000Z',
        notes: 'Initial feedback note.',
        student: { firstName: 'Diana', lastName: 'Prince', email: 'diana@vt.edu' },
        assignment: { title: 'Project 1' },
        gtaId: 'gta-current'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Edit'))
    expect(editBtn).toBeDefined()

    await editBtn!.trigger('click')

    expect(wrapper.text()).toContain('Edit Interview')
    const textarea = wrapper
      .findAll('textarea')
      .find((t) => t.element.value.includes('Initial feedback note.'))
    expect(textarea).toBeDefined()

    await textarea!.setValue('Updated rubric details.')

    // Update status to CANCELLED in modal
    const select = wrapper.find('select[aria-label="Edit appointment status"]')
    expect(select.exists()).toBe(true)
    await select.setValue('CANCELLED')

    const saveChangesBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'))
    expect(saveChangesBtn).toBeDefined()

    await saveChangesBtn!.trigger('click')
    expect(mockUpdateInterview).toHaveBeenCalledWith('res-comp-1', {
      notes: 'Updated rubric details.',
      status: 'CANCELLED'
    })
  })

  it('enforces edit control visibility based on instructor/admin or assigned GTA', async () => {
    mockUser.value = {
      id: 'gta-other',
      email: 'other@vt.edu',
      globalRole: 'USER'
    }

    mockCompletedList.value = [
      {
        id: 'res-comp-mine',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:30:00.000Z',
        endTime: '2026-10-05T09:40:00.000Z',
        notes: 'Mine',
        student: { firstName: 'Student', lastName: 'A' },
        gtaId: 'gta-other'
      },
      {
        id: 'res-comp-different',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:40:00.000Z',
        endTime: '2026-10-05T09:50:00.000Z',
        notes: 'Not mine',
        student: { firstName: 'Student', lastName: 'B' },
        gtaId: 'gta-current'
      }
    ]

    // 1. As regular GTA: can edit own, cannot edit another GTA's interview
    const wrapperRegular = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1', isInstructor: false },
      global: { stubs }
    })

    const rows = wrapperRegular.findAll('tbody tr')
    expect(rows.length).toBe(1) // Only own interview visible by default for regular GTA
    expect(rows[0].text()).toContain('Edit')

    // 2. As instructor: can view and edit all interviews
    const wrapperInstructor = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1', isInstructor: true },
      global: { stubs }
    })
    const rowsInstructor = wrapperInstructor.findAll('tbody tr')
    expect(rowsInstructor.length).toBe(2)
    expect(rowsInstructor[0].text()).toContain('Edit')
    expect(rowsInstructor[1].text()).toContain('Edit')
  })

  it('paginates expected arrivals and completed interviews when count exceeds 25', async () => {
    // Generate 30 expected arrivals
    mockExpectedArrivals.value = Array.from({ length: 30 }, (_, i) => ({
      id: `exp-${i + 1}`,
      status: 'SCHEDULED',
      startTime: `2026-10-05T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00.000Z`,
      endTime: `2026-10-05T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10 + 9).padStart(2, '0')}:00.000Z`,
      student: { firstName: `Student${i + 1}`, lastName: 'Test', email: `test${i + 1}@vt.edu` },
      assignment: { title: 'Project 1' },
      gtaId: 'gta-current'
    }))

    // Generate 30 completed interviews (all COMPLETED so visible under default filter)
    mockCompletedList.value = Array.from({ length: 30 }, (_, i) => ({
      id: `comp-${i + 1}`,
      status: 'COMPLETED',
      startTime: `2026-10-05T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00.000Z`,
      endTime: `2026-10-05T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10 + 9).padStart(2, '0')}:00.000Z`,
      student: { firstName: `PastStudent${i + 1}`, lastName: 'Test', email: `past${i + 1}@vt.edu` },
      assignment: { title: 'Project 1' },
      gtaId: 'gta-current'
    }))

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    // Set expected shift filter to ALL so all 30 upcoming arrivals are displayed
    const expectedShiftSelect = wrapper.find(
      'select[aria-label="Filter expected arrivals by shift"]'
    )
    expect(expectedShiftSelect.exists()).toBe(true)
    await expectedShiftSelect.setValue('ALL')

    // Both tables should show pagination stubs
    const paginationStubs = wrapper.findAll('[data-testid="pagination-stub"]')
    expect(paginationStubs.length).toBe(2)

    // Expected arrivals should only render 25 cards
    expect(wrapper.text()).toContain('Showing 1 to 25 of 30 expected arrivals')

    // Completed table should only render 25 rows
    const tableRows = wrapper.findAll('tbody tr')
    expect(tableRows.length).toBe(25)
    expect(wrapper.text()).toContain('Showing 1 to 25 of 30 completed interviews')
  })

  it('filters completed interviews by date range, shift, gta, and status', async () => {
    mockCompletedList.value = [
      {
        id: 'res-morning-1',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:00:00.000Z',
        endTime: '2026-10-05T09:15:00.000Z',
        student: { firstName: 'Morning', lastName: 'Alpha', email: 'alpha@vt.edu' },
        gtaId: 'gta-current'
      },
      {
        id: 'res-morning-2',
        status: 'MISSED',
        startTime: '2026-10-05T10:00:00.000Z',
        endTime: '2026-10-05T10:15:00.000Z',
        student: { firstName: 'Morning', lastName: 'Beta', email: 'beta@vt.edu' },
        gtaId: 'gta-current'
      },
      {
        id: 'res-afternoon-1',
        status: 'COMPLETED',
        startTime: '2026-10-06T14:00:00.000Z',
        endTime: '2026-10-06T14:15:00.000Z',
        student: { firstName: 'Afternoon', lastName: 'Gamma', email: 'gamma@vt.edu' },
        gtaId: 'gta-other'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1', isInstructor: true },
      global: { stubs }
    })

    // 1. By default, status is COMPLETED: res-morning-1 and res-afternoon-1 are shown
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    expect(wrapper.text()).toContain('Morning Alpha')
    expect(wrapper.text()).toContain('Afternoon Gamma')
    expect(wrapper.text()).not.toContain('Morning Beta')

    // 2. Filter by status: MISSED
    const statusSelect = wrapper.find('select[aria-label="Filter completed by status"]')
    expect(statusSelect.exists()).toBe(true)
    await statusSelect.setValue('MISSED')
    expect(wrapper.findAll('tbody tr').length).toBe(1)
    expect(wrapper.text()).toContain('Morning Beta')

    // 3. Filter by status: ALL
    await statusSelect.setValue('ALL')
    expect(wrapper.findAll('tbody tr').length).toBe(3)

    // 4. Filter by Teaching Assistant: gta-current
    const gtaSelect = wrapper.find('select[aria-label="Filter completed by teaching assistant"]')
    expect(gtaSelect.exists()).toBe(true)
    await gtaSelect.setValue('gta-current')
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    expect(wrapper.text()).toContain('Morning Alpha')
    expect(wrapper.text()).toContain('Morning Beta')
    expect(wrapper.text()).not.toContain('Afternoon Gamma')

    // 5. Filter by Date Range: 2026-10-06 to 2026-10-06
    await gtaSelect.setValue('ALL')
    const fromInput = wrapper.find('input[aria-label="Filter completed from date"]')
    const toInput = wrapper.find('input[aria-label="Filter completed to date"]')
    await fromInput.setValue('2026-10-06')
    await toInput.setValue('2026-10-06')
    expect(wrapper.findAll('tbody tr').length).toBe(1)
    expect(wrapper.text()).toContain('Afternoon Gamma')

    // 6. Reset Filters on Completed Interviews
    const resetCompletedBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Reset Filters'))
    expect(resetCompletedBtn).toBeDefined()
    await resetCompletedBtn!.trigger('click')
    // Resets back to COMPLETED status (2 completed items)
    expect(wrapper.findAll('tbody tr').length).toBe(2)
  })

  it('defaults expected arrivals to current shift (or next shift) and supports GTA selection for instructors', async () => {
    // Current shift: 10:00 to 12:00 for gta-current
    // Next shift: 14:00 to 16:00 for gta-other
    mockCourseShifts.value = [
      {
        id: 'shift-1',
        userId: 'gta-current',
        date: '2026-10-05T00:00:00.000Z',
        startTime: '10:00',
        endTime: '12:00'
      },
      {
        id: 'shift-2',
        userId: 'gta-other',
        date: '2026-10-05T00:00:00.000Z',
        startTime: '14:00',
        endTime: '16:00'
      }
    ]

    const mornStart = combineDateAndTime('2026-10-05', '10:15', DEFAULT_GTA_TIMEZONE).toISOString()
    const mornEnd = combineDateAndTime('2026-10-05', '10:25', DEFAULT_GTA_TIMEZONE).toISOString()
    const afterStart = combineDateAndTime('2026-10-05', '14:30', DEFAULT_GTA_TIMEZONE).toISOString()
    const afterEnd = combineDateAndTime('2026-10-05', '14:40', DEFAULT_GTA_TIMEZONE).toISOString()

    mockExpectedArrivals.value = [
      {
        id: 'exp-morning-1',
        status: 'SCHEDULED',
        startTime: mornStart,
        endTime: mornEnd,
        student: { firstName: 'Morning', lastName: 'Arrival', email: 'morn@vt.edu' },
        gtaId: 'gta-current'
      },
      {
        id: 'exp-afternoon-1',
        status: 'SCHEDULED',
        startTime: afterStart,
        endTime: afterEnd,
        student: { firstName: 'Afternoon', lastName: 'Arrival', email: 'after@vt.edu' },
        gtaId: 'gta-other'
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1', isInstructor: true },
      global: { stubs }
    })

    // By default for instructor with 'ALL' GTAs, it scopes to the active/earliest next shift
    const expectedCards = wrapper.findAll('.space-y-4 .grid-cols-1.md\\:grid-cols-2 > div')
    expect(expectedCards.length).toBeGreaterThanOrEqual(1)

    // Select gta-other specifically in Expected Arrivals GTA filter
    const expectedGtaSelect = wrapper.find(
      'select[aria-label="Filter expected arrivals by teaching assistant"]'
    )
    expect(expectedGtaSelect.exists()).toBe(true)
    await expectedGtaSelect.setValue('gta-other')

    // Now it should show arrivals for gta-other's shift
    expect(wrapper.text()).toContain('Afternoon Arrival')
    expect(wrapper.text()).not.toContain('Morning Arrival')
  })
})
