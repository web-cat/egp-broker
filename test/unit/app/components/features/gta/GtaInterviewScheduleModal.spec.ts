import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import GtaInterviewScheduleModal from '~/components/features/gta/GtaInterviewScheduleModal.vue'
import type { GtaInterviewReservationDto } from '@@/shared/schemas/gta-interview.schema'

const mockSlotsData = ref<any>({
  blocks: [
    {
      id: '2026-10-05-morning',
      date: '2026-10-05',
      period: 'morning',
      label: 'Monday, Oct 5 (Morning)',
      openSlotsCount: 2,
      totalCapacity: 4,
      slots: [
        {
          startTime: '2026-10-05T09:00:00.000Z',
          endTime: '2026-10-05T09:10:00.000Z',
          timeLabel: '9:00 AM',
          availableCapacity: 1,
          totalGtasOnDuty: 1
        },
        {
          startTime: '2026-10-05T09:10:00.000Z',
          endTime: '2026-10-05T09:20:00.000Z',
          timeLabel: '9:10 AM',
          availableCapacity: 1,
          totalGtasOnDuty: 1
        }
      ]
    }
  ]
})

const mockMyReservation = ref<any>(null)
const mockRefreshSlots = vi.fn()
const mockRefreshReservation = vi.fn()
const mockBookSlot = vi.fn()
const mockCancelReservation = vi.fn()

vi.mock('~/composables/features/useGtaInterviewStudent', () => ({
  useGtaInterviewStudent: () => ({
    slotsData: mockSlotsData,
    slotsStatus: ref('idle'),
    refreshSlots: mockRefreshSlots,
    myReservation: mockMyReservation,
    reservationStatus: ref('idle'),
    refreshReservation: mockRefreshReservation,
    isBooking: ref(false),
    isCancelling: ref(false),
    bookSlot: mockBookSlot,
    cancelReservation: mockCancelReservation
  })
}))

describe('GtaInterviewScheduleModal', () => {
  const mockAssignment: any = {
    id: 'asg-gta-1',
    title: 'Project 1: Memory Manager',
    hasInterviews: true,
    interviewWindowStart: '2026-10-01T00:00:00.000Z',
    interviewWindowEnd: '2026-10-15T23:59:59.000Z'
  }

  const mockExistingReservation: GtaInterviewReservationDto = {
    id: 'res-gta-1',
    assignmentId: 'asg-gta-1',
    studentId: 'student-1',
    gtaId: 'gta-1',
    startTime: '2026-10-05T09:00:00.000Z',
    endTime: '2026-10-05T09:10:00.000Z',
    status: 'SCHEDULED',
    interviewLocation: 'McBryde 106',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    gta: {
      id: 'gta-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'asmith@vt.edu'
    }
  }

  const stubs = {
    UModal: {
      template: '<div><slot name="body" /><slot name="footer" /></div>'
    },
    UIcon: true,
    UBadge: {
      template: '<span><slot /></span>'
    },
    UButton: {
      props: ['label', 'disabled', 'loading'],
      template: '<button :disabled="disabled"><slot />{{ label }}</button>'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMyReservation.value = null
  })

  it('renders Mode A: active reservation details when reservation exists', () => {
    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: mockExistingReservation,
        interviewLocation: 'McBryde 106'
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Interview Reservation')
    expect(wrapper.text()).toContain('SCHEDULED')
    expect(wrapper.text()).toContain('Alice Smith')
    expect(wrapper.text()).toContain('McBryde 106')
    expect(wrapper.text()).toContain('Reschedule Appointment')
    expect(wrapper.text()).toContain('Cancel Reservation')
  })

  it('renders Mode A: completed reservation view without reschedule/cancel actions', () => {
    const completedReservation: GtaInterviewReservationDto = {
      ...mockExistingReservation,
      status: 'COMPLETED'
    }

    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: completedReservation
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('COMPLETED')
    expect(wrapper.text()).toContain('Your grading interview is complete')
    expect(wrapper.text()).not.toContain('Reschedule Appointment')
    expect(wrapper.text()).not.toContain('Cancel Reservation')
  })

  it('renders Mode A: missed reservation view with reschedule prompt', () => {
    const missedReservation: GtaInterviewReservationDto = {
      ...mockExistingReservation,
      status: 'MISSED'
    }

    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: missedReservation
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('MISSED')
    expect(wrapper.text()).toContain('You missed your scheduled interview time')
    expect(wrapper.text()).toContain('Reschedule Appointment')
  })

  it('renders Mode A: cancelled reservation view with reschedule prompt and no cancel button', () => {
    const cancelledReservation: GtaInterviewReservationDto = {
      ...mockExistingReservation,
      id: 'res-gta-cancelled',
      status: 'CANCELLED'
    }

    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: cancelledReservation
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('CANCELLED')
    expect(wrapper.text()).toContain('This interview reservation was cancelled')
    expect(wrapper.text()).toContain('Reschedule Appointment')
    expect(wrapper.text()).not.toContain('Cancel Reservation')
  })

  it('passes rescheduleReservationId when rescheduling a SCHEDULED appointment', async () => {
    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: mockExistingReservation,
        interviewLocation: 'McBryde 106'
      },
      global: { stubs }
    })

    // Click Reschedule Appointment
    const buttons = wrapper.findAll('button')
    const rescheduleBtn = buttons.find((b) => b.text().includes('Reschedule Appointment'))
    expect(rescheduleBtn).toBeDefined()
    await rescheduleBtn!.trigger('click')

    // In Mode B, step 1: select block
    const blockBtn = wrapper.find('button.text-left')
    expect(blockBtn.exists()).toBe(true)
    await blockBtn.trigger('click')

    // Step 2: select slot
    const slotBtns = wrapper.findAll('button')
    const nineAmBtn = slotBtns.find((b) => b.text().includes('9:00 AM'))
    expect(nineAmBtn).toBeDefined()
    await nineAmBtn!.trigger('click')

    // Step 3: confirm booking
    const step3Btns = wrapper.findAll('button')
    const confirmBtn = step3Btns.find((b) => b.text().includes('Confirm Interview Booking'))
    expect(confirmBtn).toBeDefined()

    mockBookSlot.mockResolvedValueOnce({
      ...mockExistingReservation,
      id: 'res-new-gta'
    })
    await confirmBtn!.trigger('click')

    expect(mockBookSlot).toHaveBeenCalledWith('2026-10-05T09:00:00.000Z', 'res-gta-1')
    expect(wrapper.emitted('reserved')).toBeTruthy()
  })

  it('navigates Mode B 3-step wizard and confirms booking', async () => {
    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: null,
        interviewLocation: 'Zoom: https://zoom.us/j/12345'
      },
      global: { stubs }
    })

    // Step 1: select half-day block
    expect(wrapper.text()).toContain('Step 1 of 3: Half-Day Period')
    expect(wrapper.text()).toContain('Monday, Oct 5 (Morning)')

    const blockBtn = wrapper.find('button.text-left')
    expect(blockBtn.exists()).toBe(true)
    await blockBtn.trigger('click')

    // Step 2: select 10-min slot
    expect(wrapper.text()).toContain('Step 2 of 3: Time Slot')
    expect(wrapper.text()).toContain('9:00 AM')

    const slotBtns = wrapper.findAll('button')
    const nineAmBtn = slotBtns.find((b) => b.text().includes('9:00 AM'))
    expect(nineAmBtn).toBeDefined()
    await nineAmBtn!.trigger('click')

    // Step 3: review and confirm booking
    expect(wrapper.text()).toContain('Step 3 of 3: Confirm Booking')
    expect(wrapper.text()).toContain('Zoom: https://zoom.us/j/12345')
    expect(wrapper.text()).toContain('Confirm Interview Booking')

    const step3Btns = wrapper.findAll('button')
    const confirmBtn = step3Btns.find((b) => b.text().includes('Confirm Interview Booking'))
    expect(confirmBtn).toBeDefined()

    mockBookSlot.mockResolvedValueOnce(mockExistingReservation)
    await confirmBtn!.trigger('click')

    expect(mockBookSlot).toHaveBeenCalledWith('2026-10-05T09:00:00.000Z')
    expect(wrapper.emitted('reserved')).toBeTruthy()
  })

  it('cancels existing reservation and emits cancelled event', async () => {
    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: mockExistingReservation
      },
      global: { stubs }
    })

    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.text().includes('Cancel Reservation'))
    expect(cancelBtn).toBeDefined()

    mockCancelReservation.mockResolvedValueOnce(undefined)
    await cancelBtn!.trigger('click')

    expect(mockCancelReservation).toHaveBeenCalledWith('res-gta-1')
    expect(wrapper.emitted('cancelled')).toBeTruthy()
  })

  it('renders Step 1 half-day blocks with CBTF-style scheduling information', async () => {
    mockSlotsData.value = {
      blocks: [
        {
          id: '2026-10-05-morning',
          date: '2026-10-05',
          dayOfWeek: 1,
          dayName: 'Monday',
          blockType: 'MORNING',
          label: 'Monday Morning',
          dateLabel: 'Oct 5',
          timeRangeLabel: 'Morning (Before 12:30 PM)',
          isCurrentBlock: true,
          openSlotsCount: 2,
          totalSlotsCount: 6,
          utilizationPercentage: 67,
          isHighDemand: true,
          slots: [
            {
              startTime: '2026-10-05T09:00:00.000Z',
              endTime: '2026-10-05T09:10:00.000Z',
              time24: '09:00',
              label: '9:00 AM – 9:05 AM',
              availableGtaCount: 1,
              totalGtaCount: 1
            }
          ]
        },
        {
          id: '2026-10-05-afternoon',
          date: '2026-10-05',
          dayOfWeek: 1,
          dayName: 'Monday',
          blockType: 'AFTERNOON',
          label: 'Monday Afternoon',
          dateLabel: 'Oct 5',
          timeRangeLabel: 'Afternoon (12:30 PM & Later)',
          isCurrentBlock: false,
          openSlotsCount: 5,
          totalSlotsCount: 6,
          utilizationPercentage: 17,
          isHighDemand: false,
          slots: [
            {
              startTime: '2026-10-05T13:00:00.000Z',
              endTime: '2026-10-05T13:10:00.000Z',
              time24: '13:00',
              label: '1:00 PM – 1:05 PM',
              availableGtaCount: 2,
              totalGtaCount: 2
            }
          ]
        }
      ]
    }

    const wrapper = mount(GtaInterviewScheduleModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignment: mockAssignment,
        existingReservation: null
      },
      global: { stubs }
    })

    const text = wrapper.text()
    // Labels and subheaders
    expect(text).toContain('Monday Morning')
    expect(text).toContain('Oct 5 • Morning (Before 12:30 PM)')
    expect(text).toContain('Monday Afternoon')
    expect(text).toContain('Oct 5 • Afternoon (12:30 PM & Later)')

    // Badges & Metrics
    expect(text).toContain('In Progress')
    expect(text).toContain('High Demand')
    expect(text).toContain('5 slots open')
    expect(text).toContain('67% full')
    expect(text).toContain('4 / 6 booked')
    expect(text).toContain('17% full')
    expect(text).toContain('1 / 6 booked')
  })
})
