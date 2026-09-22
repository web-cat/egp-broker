import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, h } from 'vue'
import { useStudentDashboard } from '../../../../app/composables/features/useStudentDashboard'

const {
  mockPassPools,
  mockPassTypes,
  mockAssignments,
  mockRedemptions,
  mockEnrollment,
  mockGetReservationForAssignment
} = vi.hoisted(() => {
  return {
    mockPassPools: {
      value: {
        data: [{ id: 'p1', name: 'Quiz Pass', balance: 2, hoursPerPass: 168 }]
      }
    },
    mockPassTypes: {
      value: {
        data: [{ id: 'pt1', name: 'Quiz Pass', initialBalance: 2, hoursPerPass: 168 }]
      }
    },
    mockAssignments: {
      value: {
        data: []
      }
    },
    mockRedemptions: {
      value: {
        data: []
      }
    },
    mockEnrollment: {
      value: {
        data: { courseId: 'c1' }
      }
    },
    mockGetReservationForAssignment: vi.fn().mockReturnValue(null)
  }
})

// Stub Globals
const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('h', h)
vi.stubGlobal('resolveComponent', (name: string) => name)

vi.stubGlobal('useFetch', (url: string) => {
  if (url === '/api/me/pass-pools') {
    return { data: mockPassPools, status: ref('success'), refresh: vi.fn() }
  }
  if (url === '/api/me/pass-types') {
    return { data: mockPassTypes, status: ref('success'), refresh: vi.fn() }
  }
  if (url === '/api/me/assignments') {
    return { data: mockAssignments, status: ref('success'), refresh: vi.fn() }
  }
  if (url === '/api/me/redemptions') {
    return { data: mockRedemptions, status: ref('success'), refresh: vi.fn() }
  }
  return { data: ref({ data: [] }), status: ref('success'), refresh: vi.fn() }
})

vi.mock('~/composables/features/useCbtfStudent', () => ({
  useCbtfStudent: () => ({
    nextUpcomingReservation: ref(null),
    getReservationForAssignment: mockGetReservationForAssignment,
    refreshReservations: vi.fn()
  })
}))

vi.mock('~/composables/features/useEnrollmentsFeature', () => ({
  useCurrentEnrollment: () => ({
    data: mockEnrollment
  })
}))

describe('useStudentDashboard - hasBalance and pass redemption column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReservationForAssignment.mockReturnValue(null)
    mockPassPools.value = {
      data: [{ id: 'p1', name: 'Quiz Pass', balance: 2, hoursPerPass: 168 }]
    }
    mockRedemptions.value = { data: [] }
  })

  it('renders a clickable button when pass is eligible and student has balance > 0', () => {
    const dashboard = useStudentDashboard()

    const col = dashboard.assignmentColumns.find((c: any) => c.accessorKey === 'eligiblePassTypes')
    expect(col).toBeDefined()

    const mockRow = {
      original: {
        id: 'asg-1',
        title: 'Quiz 1',
        dueDate: '2026-09-18T17:00:00Z',
        eligiblePassTypes: [
          {
            id: 'pt1',
            name: 'Quiz Pass',
            hoursPerPass: 168,
            extensionOnly: false,
            minDaysPastDue: 0,
            maxDaysPastDue: 7,
            maxRedemptionsPerAssignment: 1
          }
        ]
      }
    }

    // Now is within 0-7 days (e.g. 2026-09-22)
    const vnode = col.cell({ row: mockRow })
    expect(vnode).toBeDefined()
    expect(vnode.children).toHaveLength(1)
    const buttonNode = vnode.children[0]
    expect(buttonNode.type).toBe('button')
    expect(buttonNode.props.disabled).toBeUndefined()
  })

  it('renders a disabled button with "(0 left)" when balance is 0', () => {
    mockPassPools.value = {
      data: [{ id: 'p1', name: 'Quiz Pass', balance: 0, hoursPerPass: 168 }]
    }

    const dashboard = useStudentDashboard()
    const col = dashboard.assignmentColumns.find((c: any) => c.accessorKey === 'eligiblePassTypes')

    const mockRow = {
      original: {
        id: 'asg-1',
        title: 'Quiz 1',
        dueDate: '2026-09-18T17:00:00Z',
        eligiblePassTypes: [
          {
            id: 'pt1',
            name: 'Quiz Pass',
            hoursPerPass: 168,
            extensionOnly: false,
            minDaysPastDue: 0,
            maxDaysPastDue: 7,
            maxRedemptionsPerAssignment: 1
          }
        ]
      }
    }

    const vnode = col.cell({ row: mockRow })
    expect(vnode).toBeDefined()
    expect(vnode.children).toHaveLength(1)
    const buttonNode = vnode.children[0]
    expect(buttonNode.type).toBe('button')
    expect(buttonNode.props.disabled).toBe(true)
    expect(buttonNode.children[1]).toContain('(0 left)')
  })

  describe('filteredAssignments visibility', () => {
    it('shows assignment when acceptUntil is in the future', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'asg-open',
            title: 'Open HW',
            dueDate: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 0 }]
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).toContain('asg-open')
    })

    it('shows assignment when past acceptUntil but within max pass redemption window', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'asg-redeemable',
            title: 'Redeemable Quiz',
            dueDate: new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).toContain('asg-redeemable')
    })

    it('hides assignment when past acceptUntil AND past max pass redemption date', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'asg-expired',
            title: 'Old Quiz',
            dueDate: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).not.toContain('asg-expired')
    })

    it('hides CBTF assignment when past acceptUntil/scheduleWindowEnd AND past max pass redemption date', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'cbtf-expired',
            title: 'Past CBTF Quiz',
            isSchedulable: true,
            dueDate: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            scheduleWindowEnd: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).not.toContain(
        'cbtf-expired'
      )
    })

    it('shows assignment if student has an active reservation even if past cutoff', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'cbtf-with-res',
            title: 'Past CBTF With Active Res',
            isSchedulable: true,
            dueDate: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            scheduleWindowEnd: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }
      mockGetReservationForAssignment.mockReturnValue({
        status: 'SCHEDULED',
        endTime: new Date(now.getTime() + 3600 * 1000).toISOString()
      })

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).toContain('cbtf-with-res')
    })

    it('shows assignment if student has an active extension even if past orig cutoff and max redemption', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'asg-extended',
            title: 'Extended HW',
            dueDate: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            acceptUntil: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }
      mockRedemptions.value = {
        data: [
          {
            assignmentTitle: 'Extended HW',
            acceptUntil: new Date(now.getTime() + 2 * 24 * 3600 * 1000).toISOString()
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).toContain('asg-extended')
    })

    it('shows schedulable assignment without passes when scheduleWindowEnd is in the future', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'cbtf-open-no-pass',
            title: 'CBTF Exam No Pass',
            isSchedulable: true,
            scheduleWindowEnd: new Date(now.getTime() + 2 * 24 * 3600 * 1000).toISOString()
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).toContain(
        'cbtf-open-no-pass'
      )
    })

    it('hides schedulable assignment without passes when scheduleWindowEnd is in the past', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'cbtf-past-no-pass',
            title: 'CBTF Exam Past',
            isSchedulable: true,
            scheduleWindowEnd: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString()
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).not.toContain(
        'cbtf-past-no-pass'
      )
    })

    it('hides unpublished assignments even if dates are in the future', () => {
      const now = new Date()
      mockAssignments.value = {
        data: [
          {
            id: 'unpublished-asg',
            title: 'Draft HW',
            published: false,
            dueDate: new Date(now.getTime() + 5 * 24 * 3600 * 1000).toISOString(),
            eligiblePassTypes: [{ id: 'pt1', name: 'Pass', maxDaysPastDue: 7 }]
          }
        ]
      }

      const dashboard = useStudentDashboard()
      expect(dashboard.filteredAssignments.value.map((a: any) => a.id)).not.toContain(
        'unpublished-asg'
      )
    })
  })
})
