import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveStudentEffectiveDates } from '@@/server/utils/overrides'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfReservation: {
      findMany: vi.fn()
    },
    assignmentOverrideStudent: {
      findFirst: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    },
    assignmentOverride: {
      findFirst: vi.fn()
    }
  }
}))

describe('resolveStudentEffectiveDates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])
  })

  const baseAssignment = {
    id: 'a1',
    dueDate: new Date('2026-05-20T23:59:00.000Z'),
    availableFrom: new Date('2026-05-01T00:00:00.000Z'),
    acceptUntil: new Date('2026-05-20T23:59:00.000Z')
  }

  it('returns individual student override if present (Tier 1)', async () => {
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue({
      id: 'aos1',
      overrideId: 'o1',
      userId: 'u1',
      override: {
        id: 'o1',
        assignmentId: 'a1',
        title: 'Individual Accommodation',
        dueDate: new Date('2026-05-25T23:59:00.000Z'),
        availableFrom: null,
        acceptUntil: new Date('2026-05-25T23:59:00.000Z')
      }
    } as any)

    const result = await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(result.overrideType).toBe('STUDENT')
    expect(result.dueDate?.toISOString()).toBe('2026-05-25T23:59:00.000Z')
    expect(result.availableFrom?.toISOString()).toBe('2026-05-01T00:00:00.000Z') // Inherited from base
    expect(result.overrideTitle).toBe('Individual Accommodation')
  })

  it('queries individual overrides with NOT filter for CBTF Exam Slot and linked CBTF canvasOverrideIds', async () => {
    vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([
      { canvasOverrideId: 'cbtf-ov-123' }
    ] as any)
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ courseSectionId: null } as any)

    await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(prisma.cbtfReservation.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        assignmentId: 'a1',
        canvasOverrideId: { not: null }
      },
      select: { canvasOverrideId: true }
    })

    expect(prisma.assignmentOverrideStudent.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        override: {
          assignmentId: 'a1',
          NOT: [
            { title: { equals: 'CBTF Exam Slot', mode: 'insensitive' } },
            { title: { startsWith: 'CBTF', mode: 'insensitive' } },
            { canvasOverrideId: { in: ['cbtf-ov-123'] } }
          ]
        }
      },
      include: { override: true }
    })
  })

  it('bypasses CBTF overrides and falls back to section override when present', async () => {
    // findFirst returns null because CBTF overrides are filtered out in the database query
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      courseSectionId: 'cs-002'
    } as any)
    vi.mocked(prisma.assignmentOverride.findFirst).mockResolvedValue({
      id: 'sec-ov-1',
      assignmentId: 'a1',
      title: 'Section 002 Override',
      dueDate: new Date('2026-05-22T17:00:00.000Z'),
      availableFrom: null,
      acceptUntil: new Date('2026-05-22T17:00:00.000Z')
    } as any)

    const result = await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(result.overrideType).toBe('SECTION')
    expect(result.dueDate?.toISOString()).toBe('2026-05-22T17:00:00.000Z')
    expect(result.overrideTitle).toBe('Section 002 Override')
  })

  it('bypasses CBTF overrides and falls back to base assignment dates when no section override exists', async () => {
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      courseSectionId: null
    } as any)

    const result = await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(result.overrideType).toBe('NONE')
    expect(result.dueDate?.toISOString()).toBe('2026-05-20T23:59:00.000Z')
    expect(result.overrideTitle).toBeNull()
  })

  it('returns section override if student has section and no individual override (Tier 2)', async () => {
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      courseSectionId: 'cs1'
    } as any)
    vi.mocked(prisma.assignmentOverride.findFirst).mockResolvedValue({
      id: 'o2',
      assignmentId: 'a1',
      title: 'Section 002',
      dueDate: new Date('2026-05-22T23:59:00.000Z'),
      availableFrom: null,
      acceptUntil: null
    } as any)

    const result = await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(result.overrideType).toBe('SECTION')
    expect(result.dueDate?.toISOString()).toBe('2026-05-22T23:59:00.000Z')
    expect(result.overrideTitle).toBe('Section 002')
  })

  it('falls back to base assignment dates if no overrides exist (Tier 3)', async () => {
    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      courseSectionId: null
    } as any)

    const result = await resolveStudentEffectiveDates(baseAssignment, 'u1', 'c1')

    expect(result.overrideType).toBe('NONE')
    expect(result.dueDate?.toISOString()).toBe('2026-05-20T23:59:00.000Z')
    expect(result.overrideTitle).toBeNull()
  })
})
