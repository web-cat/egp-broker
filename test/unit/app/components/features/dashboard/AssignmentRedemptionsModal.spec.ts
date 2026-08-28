import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AssignmentRedemptionsModal from '~/components/features/dashboard/AssignmentRedemptionsModal.vue'

// Mock dependencies
vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null | undefined) => (d ? 'Formatted Date' : null)
}))

describe('AssignmentRedemptionsModal', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [] }))
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
})
