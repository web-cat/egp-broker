import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TeacherRedeemPassModal from '~/components/features/dashboard/TeacherRedeemPassModal.vue'
import type { StudentRosterRow } from '@@/shared/models/teacher'
import type { AssignmentRow } from '@@/shared/models/assignment'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

describe('TeacherRedeemPassModal', () => {
  const baseStudent: StudentRosterRow = {
    userId: 'user-1',
    studentName: 'Alice Smith',
    studentEmail: 'alice@example.edu',
    sectionName: 'Lab 01',
    passBalances: [
      {
        passTypeId: 'pt-1',
        passTypeName: 'Late Pass',
        balance: 2,
        initialBalance: 3
      }
    ],
    totalRedemptions: 0
  }

  const baseAssignments: AssignmentRow[] = [
    {
      id: 'assign-1',
      resourceLinkId: 'rl-1',
      title: 'Homework 1',
      canvasAssignmentId: '1001',
      courseLabel: 'CS 101',
      courseTitle: 'Introduction to CS',
      dueDate: '2026-09-10T23:59:59.000Z',
      availableFrom: '2026-09-01T00:00:00.000Z',
      acceptUntil: '2026-09-10T23:59:59.000Z',
      published: true,
      isSchedulable: false,
      hasInterviews: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      eligiblePassTypes: [
        {
          id: 'pt-1',
          name: 'Late Pass',
          hoursPerPass: 48,
          extensionOnly: false,
          minDaysPastDue: 0,
          maxDaysPastDue: 5 // Min/max days configured, but should NOT filter for teacher!
        },
        {
          id: 'pt-2',
          name: 'Emergency Pass',
          hoursPerPass: 72,
          extensionOnly: true,
          minDaysPastDue: 3,
          maxDaysPastDue: 10
        }
      ]
    },
    {
      id: 'assign-2',
      resourceLinkId: 'rl-2',
      title: 'Lab 2',
      canvasAssignmentId: '1002',
      courseLabel: 'CS 101',
      courseTitle: 'Introduction to CS',
      dueDate: '2026-09-15T23:59:59.000Z',
      availableFrom: '2026-09-05T00:00:00.000Z',
      acceptUntil: '2026-09-15T23:59:59.000Z',
      published: true,
      isSchedulable: false,
      hasInterviews: false,
      createdAt: '2026-09-05T00:00:00.000Z',
      eligiblePassTypes: []
    }
  ]

  beforeEach(() => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        statusCode: 200,
        data: {
          redemption: { id: 'red-1' },
          passBalances: [
            { passTypeId: 'pt-1', passTypeName: 'Late Pass', balance: 1, initialBalance: 3 }
          ]
        }
      })
    )
    vi.clearAllMocks()
  })

  it('renders student name and email in modal description', () => {
    let capturedDescription = ''
    mount(TeacherRedeemPassModal, {
      props: {
        open: true,
        student: baseStudent,
        assignments: baseAssignments
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          USelect: true,
          UInput: true,
          USwitch: true,
          UButton: true,
          UIcon: true
        }
      }
    })

    expect(capturedDescription).toContain('Alice Smith')
    expect(capturedDescription).toContain('alice@example.edu')
  })

  it('populates assignment options from props.assignments', () => {
    const wrapper = mount(TeacherRedeemPassModal, {
      props: {
        open: true,
        student: baseStudent,
        assignments: baseAssignments
      },
      global: {
        stubs: {
          UModal: true,
          USelect: true,
          UInput: true,
          USwitch: true,
          UButton: true,
          UIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    expect(vm.assignmentOptions).toHaveLength(2)
    expect(vm.assignmentOptions[0].label).toBe('Homework 1')
  })

  it('populates eligible pass types when an assignment is selected without filtering by min/max days', async () => {
    const wrapper = mount(TeacherRedeemPassModal, {
      props: {
        open: true,
        student: baseStudent,
        assignments: baseAssignments
      },
      global: {
        stubs: {
          UModal: true,
          USelect: true,
          UInput: true,
          USwitch: true,
          UButton: true,
          UIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedAssignmentId = 'assign-1'
    await wrapper.vm.$nextTick()

    // Both pass types should be present despite min/max days restrictions
    expect(vm.passTypeOptions).toHaveLength(2)
    expect(vm.passTypeOptions[0].value).toBe('pt-1')
    expect(vm.passTypeOptions[1].value).toBe('pt-2')
  })

  it('auto-defaults start and end dates based on passType hoursPerPass', async () => {
    const wrapper = mount(TeacherRedeemPassModal, {
      props: {
        open: true,
        student: baseStudent,
        assignments: baseAssignments
      },
      global: {
        stubs: {
          UModal: true,
          USelect: true,
          UInput: true,
          USwitch: true,
          UButton: true,
          UIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedAssignmentId = 'assign-1'
    vm.selectedPassTypeId = 'pt-1' // 48h
    await wrapper.vm.$nextTick()

    expect(vm.startDate).toBeTruthy()
    expect(vm.endDate).toBeTruthy()

    const startMs = new Date(vm.startDate).getTime()
    const endMs = new Date(vm.endDate).getTime()
    const diffHours = Math.round((endMs - startMs) / (3600 * 1000))
    expect(diffHours).toBe(48)
  })

  it('submits force redemption and emits redeemed event on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      statusCode: 200,
      data: {
        redemption: { id: 'red-1' },
        passBalances: [
          { passTypeId: 'pt-1', passTypeName: 'Late Pass', balance: 1, initialBalance: 3 }
        ]
      }
    })
    vi.stubGlobal('$fetch', mockFetch)

    const wrapper = mount(TeacherRedeemPassModal, {
      props: {
        open: true,
        student: baseStudent,
        assignments: baseAssignments
      },
      global: {
        stubs: {
          UModal: true,
          USelect: true,
          UInput: true,
          USwitch: true,
          UButton: true,
          UIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedAssignmentId = 'assign-1'
    vm.selectedPassTypeId = 'pt-1'
    vm.deductFromBalance = true
    await wrapper.vm.$nextTick()

    await vm.handleSubmit()

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/students/user-1/redemptions',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          assignmentId: 'assign-1',
          passTypeId: 'pt-1',
          deductFromBalance: true
        })
      })
    )

    expect(wrapper.emitted('redeemed')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toContainEqual([false])
  })
})
