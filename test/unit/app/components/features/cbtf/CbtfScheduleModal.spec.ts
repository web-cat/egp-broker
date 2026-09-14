import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
})
