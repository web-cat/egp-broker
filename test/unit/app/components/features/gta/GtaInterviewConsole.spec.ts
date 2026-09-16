import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import GtaInterviewConsole from '~/components/features/gta/GtaInterviewConsole.vue'

const mockActiveInterview = ref<any>(null)
const mockExpectedArrivals = ref<any[]>([])
const mockCompletedList = ref<any[]>([])
const mockFeedStatus = ref('idle')
const mockIsUpdating = ref(false)

const mockRefreshFeed = vi.fn()
const mockCheckIn = vi.fn()
const mockCheckOut = vi.fn()
const mockSaveNotes = vi.fn()
const mockMarkNoShow = vi.fn()

vi.mock('~/composables/features/useGtaInterviewConsole', () => ({
  useGtaInterviewConsole: () => ({
    activeInterview: mockActiveInterview,
    expectedArrivals: mockExpectedArrivals,
    completedList: mockCompletedList,
    feedStatus: mockFeedStatus,
    isUpdating: mockIsUpdating,
    refreshFeed: mockRefreshFeed,
    checkIn: mockCheckIn,
    checkOut: mockCheckOut,
    saveNotes: mockSaveNotes,
    markNoShow: mockMarkNoShow
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
      props: ['label', 'disabled', 'loading'],
      template: '<button :disabled="disabled"><slot />{{ label }}</button>'
    },
    UTextarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(mockSaveNotes).toHaveBeenCalledWith('res-active-1', 'Understands pointers well.')

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
        assignment: { id: 'asg-1', title: 'Project 1' }
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
        assignment: { id: 'asg-1', title: 'Project 1' }
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

  it('renders completed appointments in history section', () => {
    mockCompletedList.value = [
      {
        id: 'res-done-1',
        status: 'COMPLETED',
        startTime: '2026-10-05T09:40:00.000Z',
        endTime: '2026-10-05T09:50:00.000Z',
        notes: 'Graded: full credit.',
        student: { firstName: 'Diana', lastName: 'Prince', email: 'diana@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' }
      },
      {
        id: 'res-missed-1',
        status: 'MISSED',
        startTime: '2026-10-05T09:30:00.000Z',
        endTime: '2026-10-05T09:40:00.000Z',
        notes: null,
        student: { firstName: 'Evan', lastName: 'Wright', email: 'evan@vt.edu' },
        assignment: { id: 'asg-1', title: 'Project 1' }
      }
    ]

    const wrapper = mount(GtaInterviewConsole, {
      props: { courseId: 'course-1' },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Shift History & Completed')
    expect(wrapper.text()).toContain('Diana Prince')
    expect(wrapper.text()).toContain('Graded: full credit.')
    expect(wrapper.text()).toContain('Evan Wright')
    expect(wrapper.text()).toContain('MISSED')
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
      checkOut: vi.fn(),
      saveNotes: vi.fn(),
      markNoShow: vi.fn(),
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
})
