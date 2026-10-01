import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssignmentRedemptionsModal from '~/components/features/dashboard/AssignmentRedemptionsModal.vue'

// Mock dependencies
vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null | undefined) => (d ? 'Formatted Date' : null)
}))

describe('AssignmentRedemptionsModal', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [] }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  it('renders associated LTI Tool name when configured', () => {
    const mockAssignment = {
      id: 'asg-1',
      resourceLinkId: 'rl-1',
      title: 'Project 1',
      canvasAssignmentId: '101',
      courseLabel: 'CS 101',
      courseTitle: 'Intro to CS',
      dueDate: '2026-09-01T23:59:00Z',
      availableFrom: '2026-08-25T00:00:00Z',
      acceptUntil: '2026-09-05T23:59:00Z',
      published: true,
      createdAt: '2026-08-20T00:00:00Z',
      toolId: 'tool-cw',
      toolName: 'CodeWorkout'
    }

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: {
            template: '<span><slot /></span>'
          },
          BaseDataTable: true,
          UButton: true
        }
      }
    })

    expect(wrapper.text()).toContain('LTI Tool:')
    expect(wrapper.text()).toContain('CodeWorkout')
    expect(wrapper.text()).toContain('Connected')
  })

  it('renders "None" and "Not Configured" when toolName is null or not set', () => {
    const mockAssignment = {
      id: 'asg-2',
      resourceLinkId: 'rl-2',
      title: 'Project 2',
      canvasAssignmentId: '102',
      courseLabel: 'CS 101',
      courseTitle: 'Intro to CS',
      dueDate: '2026-09-01T23:59:00Z',
      availableFrom: '2026-08-25T00:00:00Z',
      acceptUntil: '2026-09-05T23:59:00Z',
      published: true,
      createdAt: '2026-08-20T00:00:00Z',
      toolId: null,
      toolName: null
    }

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: {
            template: '<span><slot /></span>'
          },
          BaseDataTable: true,
          UButton: true
        }
      }
    })

    expect(wrapper.text()).toContain('LTI Tool:')
    expect(wrapper.text()).toContain('None')
    expect(wrapper.text()).toContain('Not Configured')
  })

  it('renders PassPort sync button when toolSupportsPassport is true', async () => {
    const mockAssignment = {
      id: 'asg-3',
      title: 'Program 1',
      toolId: 'tool-webcat',
      toolName: 'Web-CAT',
      toolSupportsPassport: true
    }

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment as any
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: {
            template: '<span><slot /></span>'
          },
          BaseDataTable: true,
          UButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    expect(wrapper.text()).toContain('Sync PassPort')
  })

  it('does not render PassPort sync button when toolSupportsPassport is false or undefined', () => {
    const mockAssignment = {
      id: 'asg-4',
      title: 'Lab 1',
      toolId: 'tool-other',
      toolName: 'Other Tool',
      toolSupportsPassport: false
    }

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment as any
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: {
            template: '<span><slot /></span>'
          },
          BaseDataTable: true,
          UButton: {
            template: '<button><slot /></button>'
          }
        }
      }
    })

    expect(wrapper.text()).not.toContain('Sync PassPort')
  })

  it('calls passport-sync endpoint on button click', async () => {
    const mockAssignment = {
      id: 'asg-5',
      title: 'Program 1',
      toolId: 'tool-webcat',
      toolName: 'Web-CAT',
      toolSupportsPassport: true
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('passport-sync')) {
        return Promise.resolve({
          data: { syncedCount: 2, failedCount: 0, totalCount: 2 }
        })
      }
      return Promise.resolve({ data: [{ id: 'red-1' }] })
    })
    vi.stubGlobal('$fetch', mockFetch)

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment as any
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: {
            template: '<span><slot /></span>'
          },
          BaseDataTable: true,
          UButton: {
            template: '<button class="sync-btn" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await flushPromises()

    const syncButton = wrapper.find('.sync-btn')
    expect(syncButton.exists()).toBe(true)
    await syncButton.trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/assignments/asg-5/passport-sync',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('does not render CBTF reservation status card when assignment.isSchedulable is false or undefined', async () => {
    const mockAssignment = {
      id: 'asg-regular',
      title: 'Homework 1',
      isSchedulable: false
    }

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment as any
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: true,
          BaseDataTable: true,
          UButton: true
        }
      }
    })

    await flushPromises()
    expect(wrapper.find('[data-testid="cbtf-summary-card"]').exists()).toBe(false)
  })

  it('renders CBTF reservation status visual with progress bar and stat chips when assignment.isSchedulable is true', async () => {
    const mockAssignment = {
      id: 'asg-cbtf',
      title: 'Quiz 2',
      isSchedulable: true
    }

    const mockSummary = {
      totalEnrolledCount: 80,
      completedCount: 48,
      scheduledCount: 20,
      unscheduledCount: 12,
      completedPct: 60.0,
      scheduledPct: 25.0,
      unscheduledPct: 15.0,
      remainingOpenSlots: 35,
      remainingOpenSeats: 140,
      reservationWindowEnd: '2026-10-15T23:59:00Z'
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('cbtf-reservation-summary')) {
        return Promise.resolve({ data: mockSummary })
      }
      return Promise.resolve({ data: [] })
    })
    vi.stubGlobal('$fetch', mockFetch)

    const wrapper = mount(AssignmentRedemptionsModal, {
      props: {
        open: true,
        assignment: mockAssignment as any
      },
      global: {
        stubs: {
          UModal: {
            template: '<div><slot name="body" /><slot name="footer" /></div>'
          },
          UIcon: true,
          UBadge: true,
          UTooltip: {
            template: '<div class="tooltip-stub"><slot /></div>'
          },
          BaseDataTable: true,
          UButton: true
        }
      }
    })

    await flushPromises()

    // Verify card is rendered
    const card = wrapper.find('[data-testid="cbtf-summary-card"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('CBTF Reservation Status')
    expect(card.text()).toContain('Total Enrolled:')
    expect(card.text()).toContain('80')

    // Verify window closes header
    const windowEnd = wrapper.find('[data-testid="reservation-window-end"]')
    expect(windowEnd.exists()).toBe(true)
    expect(windowEnd.text()).toContain('Window closes:')

    // Verify progress bar segments
    expect(wrapper.find('[data-testid="progress-completed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-scheduled"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-unscheduled"]').exists()).toBe(true)

    // Verify stat chips
    const completedStat = wrapper.find('[data-testid="stat-completed"]')
    expect(completedStat.exists()).toBe(true)
    expect(completedStat.text()).toContain('48')
    expect(completedStat.text()).toContain('(60%)')

    const scheduledStat = wrapper.find('[data-testid="stat-scheduled"]')
    expect(scheduledStat.exists()).toBe(true)
    expect(scheduledStat.text()).toContain('20')
    expect(scheduledStat.text()).toContain('(25%)')

    const unscheduledStat = wrapper.find('[data-testid="stat-unscheduled"]')
    expect(unscheduledStat.exists()).toBe(true)
    expect(unscheduledStat.text()).toContain('12')
    expect(unscheduledStat.text()).toContain('(15%)')

    // Verify open seats stat chip
    const openSeatsStat = wrapper.find('[data-testid="stat-open-seats"]')
    expect(openSeatsStat.exists()).toBe(true)
    expect(openSeatsStat.text()).toContain('140')
    expect(openSeatsStat.text()).toContain('(35 slots)')
  })
})
