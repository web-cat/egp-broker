import { describe, it, expect, vi } from 'vitest'
import { createStudentAssignmentColumns } from '~/composables/features/useStudentAssignmentTable'
import type { AssignmentRow } from '@@/shared/models/assignment'

describe('createStudentAssignmentColumns', () => {
  const mockAssignment: AssignmentRow = {
    id: 'assign-1',
    resourceLinkId: 'rl-1',
    title: 'Lab 1',
    canvasAssignmentId: '101',
    courseLabel: 'CS 101',
    courseTitle: 'Introduction to Computer Science',
    dueDate: '2026-10-01T12:00:00Z',
    availableFrom: '2026-09-01T12:00:00Z',
    acceptUntil: '2026-10-05T12:00:00Z',
    published: true,
    isSchedulable: true,
    hasInterviews: true,
    createdAt: '2026-09-01T00:00:00Z',
    eligiblePassTypes: [
      {
        id: 'pt-1',
        name: 'Late Pass',
        hoursPerPass: 24,
        extensionOnly: false
      }
    ]
  }

  const passPools = [
    {
      id: 'pt-1',
      passTypeId: 'pt-1',
      name: 'Late Pass',
      balance: 2,
      hoursPerPass: 24
    }
  ]

  it('produces the exact 6 columns matching the student dashboard', () => {
    const columns = createStudentAssignmentColumns({
      interactive: false,
      redemptions: [],
      passPools,
      getCbtfReservation: () => undefined,
      getGtaReservation: () => undefined
    })

    const accessorKeys = columns.map((col: any) => col.accessorKey)
    expect(accessorKeys).toEqual([
      'title',
      'eligiblePassTypes',
      'dueDate',
      'availableFrom',
      'cbtfSlot',
      'gtaInterviewSlot'
    ])
  })

  it('renders interactive buttons in interactive mode (onClick provided)', () => {
    const onRedeemClick = vi.fn()
    const onCbtfClick = vi.fn()
    const onGtaClick = vi.fn()

    const columns = createStudentAssignmentColumns({
      interactive: true,
      redemptions: [],
      passPools,
      getCbtfReservation: () => undefined,
      getGtaReservation: () => undefined,
      onRedeemClick,
      onCbtfClick,
      onGtaClick
    })

    const row = {
      original: mockAssignment,
      getValue: (key: string) => (mockAssignment as any)[key]
    }

    // CBTF column
    const cbtfCol = columns.find((c: any) => c.accessorKey === 'cbtfSlot')
    const cbtfVNode = cbtfCol.cell({ row })
    expect(cbtfVNode.type).toBe('button')
    expect(cbtfVNode.props?.onClick).toBeDefined()

    // GTA column
    const gtaCol = columns.find((c: any) => c.accessorKey === 'gtaInterviewSlot')
    const gtaVNode = gtaCol.cell({ row })
    expect(gtaVNode.type).toBe('button')
    expect(gtaVNode.props?.onClick).toBeDefined()
  })

  it('renders inactive non-clickable elements in read-only mode without onClick', () => {
    const columns = createStudentAssignmentColumns({
      interactive: false,
      redemptions: [],
      passPools,
      getCbtfReservation: () => undefined,
      getGtaReservation: () => undefined
    })

    const row = {
      original: mockAssignment,
      getValue: (key: string) => (mockAssignment as any)[key]
    }

    // CBTF column: Schedule Exam
    const cbtfCol = columns.find((c: any) => c.accessorKey === 'cbtfSlot')
    const cbtfVNode = cbtfCol.cell({ row })
    expect(cbtfVNode.type).toBe('span')
    expect(cbtfVNode.props?.onClick).toBeUndefined()
    expect(cbtfVNode.children).toEqual(expect.arrayContaining(['Schedule Exam']))

    // GTA column: Schedule Interview
    const gtaCol = columns.find((c: any) => c.accessorKey === 'gtaInterviewSlot')
    const gtaVNode = gtaCol.cell({ row })
    expect(gtaVNode.type).toBe('span')
    expect(gtaVNode.props?.onClick).toBeUndefined()
    expect(gtaVNode.children).toEqual(expect.arrayContaining(['Schedule Interview']))

    // Pass Types column: Late Pass
    const passCol = columns.find((c: any) => c.accessorKey === 'eligiblePassTypes')
    const passContainerVNode = passCol.cell({ row })
    const passVNode = passContainerVNode.children[0]
    expect(passVNode.type).toBe('span')
    expect(passVNode.props?.onClick).toBeUndefined()
    expect(passVNode.children).toEqual(expect.arrayContaining(['Late Pass']))
  })

  it('renders scheduled CBTF seat number and GTA interview time as inactive presentational elements', () => {
    const cbtfReservation = {
      id: 'res-1',
      assignmentId: 'assign-1',
      seatNumber: 42,
      status: 'SCHEDULED',
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z'
    }
    const gtaReservation = {
      id: 'gta-1',
      assignmentId: 'assign-1',
      status: 'SCHEDULED',
      startTime: '2026-10-01T14:30:00Z',
      endTime: '2026-10-01T15:00:00Z'
    }

    const columns = createStudentAssignmentColumns({
      interactive: false,
      redemptions: [],
      passPools,
      getCbtfReservation: () => cbtfReservation,
      getGtaReservation: () => gtaReservation
    })

    const row = {
      original: mockAssignment,
      getValue: (key: string) => (mockAssignment as any)[key]
    }

    const cbtfCol = columns.find((c: any) => c.accessorKey === 'cbtfSlot')
    const cbtfVNode = cbtfCol.cell({ row })
    expect(cbtfVNode.type).toBe('span')
    expect(cbtfVNode.props?.onClick).toBeUndefined()
    expect(cbtfVNode.children).toEqual(expect.arrayContaining(['Seat #42']))

    const gtaCol = columns.find((c: any) => c.accessorKey === 'gtaInterviewSlot')
    const gtaVNode = gtaCol.cell({ row })
    expect(gtaVNode.type).toBe('span')
    expect(gtaVNode.props?.onClick).toBeUndefined()
    expect(JSON.stringify(gtaVNode.children)).toContain('Scheduled')
  })
})
