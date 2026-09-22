import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CbtfScheduleModal from '~/components/features/cbtf/CbtfScheduleModal.vue'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

// Mock composable
const mockFetchAvailability = vi.fn()
const mockCreateReservation = vi.fn()
const mockRescheduleReservation = vi.fn()
const mockCancelReservation = vi.fn()

vi.mock('~/composables/features/useCbtfStudent', () => ({
  useCbtfStudent: () => ({
    fetchAvailability: mockFetchAvailability,
    createReservation: mockCreateReservation,
    rescheduleReservation: mockRescheduleReservation,
    cancelReservation: mockCancelReservation
  })
}))

describe('CbtfScheduleModal', () => {
  const mockAssignment: any = {
    id: 'asg-cbtf-1',
    title: 'Midterm Exam',
    isSchedulable: true
  }

  const mockExistingReservation: CbtfReservationDto = {
    id: 'res-1',
    userId: 'user-1',
    assignmentId: 'asg-cbtf-1',
    assignmentTitle: 'Midterm Exam',
    startTime: '2026-09-15T14:00:00.000Z',
    endTime: '2026-09-15T15:00:00.000Z',
    seatNumber: 12,
    status: 'SCHEDULED',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z'
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
    mockFetchAvailability.mockResolvedValue({
      blocks: [],
      recommendedDays: [],
      hourlySlots: []
    })
  })

  it('renders Mode A: current reservation view when existingReservation is present', () => {
    const wrapper = mount(CbtfScheduleModal, {
      props: {
        open: true,
        assignment: mockAssignment,
        existingReservation: mockExistingReservation
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Current Reservation')
    expect(wrapper.text()).toContain('Workstation Seat #12')
    expect(wrapper.text()).toContain('Reschedule Exam')
    expect(wrapper.text()).toContain('Cancel Reservation')
  })

  it('shows reassurance banner and "Keep Current Reservation" when rescheduling with no open slots', async () => {
    const wrapper = mount(CbtfScheduleModal, {
      props: {
        open: true,
        assignment: mockAssignment,
        existingReservation: mockExistingReservation
      },
      global: { stubs }
    })

    // Click "Reschedule Exam"
    const buttons = wrapper.findAll('button')
    const rescheduleBtn = buttons.find((b) => b.text().includes('Reschedule Exam'))
    expect(rescheduleBtn).toBeDefined()
    await rescheduleBtn!.trigger('click')

    // Expect availability was fetched
    expect(mockFetchAvailability).toHaveBeenCalledWith('asg-cbtf-1', undefined)

    // Check reassurance banner
    expect(wrapper.text()).toContain('Current Reservation Protected')
    expect(wrapper.text()).toContain('Workstation Seat #12')
    expect(wrapper.text()).toContain('No alternative open slots were found')

    // Check footer button says "Keep Current Reservation"
    expect(wrapper.text()).toContain('Keep Current Reservation')
  })

  it('returns to Mode A without modifying reservation when clicking "Keep Current Reservation"', async () => {
    const wrapper = mount(CbtfScheduleModal, {
      props: {
        open: true,
        assignment: mockAssignment,
        existingReservation: mockExistingReservation
      },
      global: { stubs }
    })

    // Enter rescheduling
    const buttons = wrapper.findAll('button')
    const rescheduleBtn = buttons.find((b) => b.text().includes('Reschedule Exam'))
    await rescheduleBtn!.trigger('click')

    // Click "Keep Current Reservation"
    const keepBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Keep Current Reservation'))
    expect(keepBtn).toBeDefined()
    await keepBtn!.trigger('click')

    // Should return to Mode A
    expect(wrapper.text()).toContain('Current Reservation')
    expect(wrapper.text()).toContain('Workstation Seat #12')
    expect(wrapper.text()).toContain('Reschedule Exam')
    expect(mockRescheduleReservation).not.toHaveBeenCalled()
  })

  it('renders Mode A correctly for CANCELLED reservation with reschedule button and no cancel button', () => {
    const cancelledReservation: CbtfReservationDto = {
      ...mockExistingReservation,
      id: 'res-cancelled',
      status: 'CANCELLED'
    }

    const wrapper = mount(CbtfScheduleModal, {
      props: {
        open: true,
        assignment: mockAssignment,
        existingReservation: cancelledReservation
      },
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Current Reservation')
    expect(wrapper.text()).toContain('This reservation was cancelled')
    expect(wrapper.text()).toContain('Reschedule Exam')
    expect(wrapper.text()).not.toContain('Cancel Reservation')
  })

  it('navigates back to Step 2 and displays slot unavailable message when booking encounters a 409 conflict', async () => {
    const mockBlock = {
      id: '2026-10-05-morning',
      date: '2026-10-05',
      dayOfWeek: 1,
      blockType: 'morning',
      label: 'Monday Morning',
      dateLabel: 'Oct 5',
      timeRangeLabel: '9:00 AM – 12:30 PM',
      isCurrentBlock: false,
      openSlotsCount: 2,
      totalSlotsCount: 10,
      utilizationPercentage: 80,
      isHighDemand: true
    }
    const slot1 = {
      hour: 10,
      startTime: '2026-10-05T14:00:00.000Z',
      endTime: '2026-10-05T15:00:00.000Z',
      formattedTime: '10:00 AM'
    }
    const slot2 = {
      hour: 11,
      startTime: '2026-10-05T15:00:00.000Z',
      endTime: '2026-10-05T16:00:00.000Z',
      formattedTime: '11:00 AM'
    }

    mockFetchAvailability.mockResolvedValue({
      blocks: [mockBlock],
      recommendedDays: [],
      hourlySlots: [slot1, slot2]
    })

    const conflictErr: any = new Error('Arrival capacity reached')
    conflictErr.statusCode = 409
    mockCreateReservation.mockRejectedValueOnce(conflictErr)

    const wrapper = mount(CbtfScheduleModal, {
      props: {
        open: true,
        assignment: mockAssignment,
        existingReservation: null
      },
      global: { stubs }
    })

    // Wait for availability to load
    await flushPromises()

    // Step 1: Click the block
    const blockBtn = wrapper.find('button[type="button"]')
    expect(blockBtn.exists()).toBe(true)
    await blockBtn.trigger('click')
    await flushPromises()

    // Step 2: Choose slot 1
    const slotButtons = wrapper.findAll('button[type="button"]')
    const slot1Btn = slotButtons.find((b) => b.text().includes('10:00 AM'))
    expect(slot1Btn).toBeDefined()
    await slot1Btn!.trigger('click')
    await flushPromises()

    // Step 3: Review & Confirm
    expect(wrapper.text()).toContain('Step 3 of 3')
    expect(wrapper.text()).toContain('Reservation Summary')
    const confirmBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Confirm Reservation'))
    expect(confirmBtn).toBeDefined()

    // Mock next fetch availability to only have slot2
    mockFetchAvailability.mockResolvedValueOnce({
      blocks: [mockBlock],
      recommendedDays: [],
      hourlySlots: [slot2]
    })

    // Click confirm -> triggers 409 conflict
    await confirmBtn!.trigger('click')
    await flushPromises()

    // Should now be on Step 2 of 3
    expect(wrapper.text()).toContain('Step 2 of 3')
    expect(wrapper.text()).toContain('The 10:00 AM time slot is no longer available')

    const remainingSlotButtons = wrapper.findAll('button[type="button"]')
    expect(remainingSlotButtons.some((b) => b.text().includes('10:00 AM'))).toBe(false)
    expect(remainingSlotButtons.some((b) => b.text().includes('11:00 AM'))).toBe(true)
  })
})
