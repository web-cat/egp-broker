import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StudentRedemptionsModal from '~/components/features/dashboard/StudentRedemptionsModal.vue'
import type { StudentRosterRow } from '@@/shared/models/teacher'

vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null | undefined) => (d ? 'Formatted Date' : null)
}))

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

describe('StudentRedemptionsModal', () => {
  const baseStudent: StudentRosterRow = {
    userId: 'user-1',
    studentName: 'Jane Doe',
    studentEmail: 'jane.doe@university.edu',
    sectionName: 'Lab 01',
    passBalances: [
      {
        passTypeId: 'pt-1',
        passTypeName: 'Late Pass',
        balance: 2,
        initialBalance: 3
      }
    ],
    totalRedemptions: 1
  }

  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [] }))
    vi.clearAllMocks()
  })

  it('displays student email alongside section enrollment in modal description', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: baseStudent
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
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • Section: Lab 01')
  })

  it('does not duplicate "Section:" prefix if sectionName already begins with "Section"', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          sectionName: 'Section 004'
        }
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
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • Section 004')
  })

  it('displays "No section assigned" when student has no section', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          sectionName: null
        }
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
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • No section assigned')
  })

  it('displays "No email" when student has null email', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          studentEmail: null
        }
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
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('No email • Section: Lab 01')
  })

  it('falls back to default description when student is null', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: null
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
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('Student redemption history')
  })

  it('renders Redeem Pass button and opens force redeem modal when clicked', async () => {
    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: baseStudent
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(_props, { slots }) {
              return () => slots.body?.()
            }
          },
          UIcon: true,
          UButton: {
            props: ['label', 'icon'],
            template: '<button class="u-button" :data-label="label">{{ label }}</button>'
          },
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    const vm = wrapper.vm as any
    expect(vm.forceRedeemModalOpen).toBe(false)

    const redeemBtn = wrapper.findAll('button').find((b) => b.text().includes('Redeem Pass'))
    expect(redeemBtn).toBeDefined()
    await redeemBtn?.trigger('click')

    expect(vm.forceRedeemModalOpen).toBe(true)
  })

  it('updates student balances and emits saved when onPassRedeemed is triggered', async () => {
    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent }
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    const vm = wrapper.vm as any
    const newBalances = [
      {
        passTypeId: 'pt-1',
        passTypeName: 'Late Pass',
        balance: 1,
        initialBalance: 3
      }
    ]

    vm.onPassRedeemed(newBalances)

    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')?.[0]).toEqual([newBalances])
  })

  it('fetches student interview reservations when modal opens with courseId', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/interviews')) {
        return Promise.resolve({
          data: [
            {
              id: 'res-1',
              assignmentId: 'asg-1',
              assignmentTitle: 'Project 1',
              gtaId: 'gta-1',
              gtaName: 'Alice Smith',
              gtaEmail: 'alice@example.com',
              startTime: '2026-09-25T14:00:00.000Z',
              endTime: '2026-09-25T14:15:00.000Z',
              status: 'COMPLETED',
              checkedInAt: '2026-09-25T14:00:00.000Z',
              checkedOutAt: '2026-09-25T14:15:00.000Z',
              notes: 'Passed',
              createdAt: '2026-09-24T10:00:00.000Z'
            }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })
    vi.stubGlobal('$fetch', mockFetch)

    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent },
        courseId: 'course-123'
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/user-1/interviews?courseId=course-123')
    const vm = wrapper.vm as any
    expect(vm.interviews).toHaveLength(1)
    expect(vm.interviews[0].id).toBe('res-1')
    expect(vm.interviews[0].status).toBe('COMPLETED')
  })

  it('clears redemptions and interviews when modal closes', async () => {
    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent }
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.redemptions = [{ id: 'red-1' }]
    vm.interviews = [{ id: 'res-1' }]
    vm.cbtfReservations = [{ id: 'cbtf-1' }]

    await wrapper.setProps({ open: false })

    expect(vm.redemptions).toEqual([])
    expect(vm.interviews).toEqual([])
    expect(vm.cbtfReservations).toEqual([])
  })

  it('fetches student CBTF reservations on open when student has an id', async () => {
    const mockCbtf = [
      {
        id: 'cbtf-1',
        assignmentId: 'assign-1',
        seatNumber: 15,
        status: 'SCHEDULED',
        startTime: '2026-10-01T10:00:00Z',
        endTime: '2026-10-01T11:00:00Z'
      }
    ]
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/cbtf-reservations')) {
        return Promise.resolve({ data: mockCbtf })
      }
      return Promise.resolve({ data: [] })
    })
    vi.stubGlobal('$fetch', mockFetch)

    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent },
        courseId: 'course-123'
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/students/user-1/cbtf-reservations?courseId=course-123'
    )
    const vm = wrapper.vm as any
    expect(vm.cbtfReservations).toHaveLength(1)
    expect(vm.cbtfReservations[0].id).toBe('cbtf-1')
  })

  it('computes studentFilteredAssignments and studentAssignmentColumns without interactive action buttons', async () => {
    const mockAssignments = [
      {
        id: 'assign-1',
        title: 'Midterm Exam',
        dueDate: '2026-10-15T00:00:00Z',
        availableFrom: '2026-09-01T00:00:00Z',
        acceptUntil: '2026-10-20T00:00:00Z',
        published: true,
        isSchedulable: true,
        hasInterviews: true,
        createdAt: '2026-09-01T00:00:00Z',
        eligiblePassTypes: [{ id: 'pt-1', name: 'Late Pass' }]
      }
    ]

    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent },
        assignments: mockAssignments as any,
        courseId: 'course-123'
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const vm = wrapper.vm as any
    expect(vm.studentFilteredAssignments).toHaveLength(1)
    expect(vm.studentFilteredAssignments[0].id).toBe('assign-1')

    const cols = vm.studentAssignmentColumns
    expect(cols.map((c: any) => c.accessorKey)).toEqual([
      'title',
      'eligiblePassTypes',
      'dueDate',
      'availableFrom',
      'cbtfSlot',
      'gtaInterviewSlot'
    ])

    // Inspect CBTF cell
    const cbtfCol = cols.find((c: any) => c.accessorKey === 'cbtfSlot')
    const row = {
      original: mockAssignments[0],
      getValue: (k: string) => (mockAssignments[0] as any)[k]
    }
    const cbtfVNode = cbtfCol.cell({ row })
    // In read-only mode, it is rendered as a span (not a button) with no onClick
    expect(cbtfVNode.type).toBe('span')
    expect(cbtfVNode.props?.onClick).toBeUndefined()
  })
})
