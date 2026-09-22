import type { PrismaClient } from '@prisma/client'
import prisma from '@@/server/utils/db'
import type { EffectiveAssignmentDates } from '@@/shared/models/override'

export interface AssignmentDateSource {
  id: string
  availableFrom?: Date | null
  dueDate?: Date | null
  acceptUntil?: Date | null
}

/**
 * Resolves the effective baseline dates for a student on an assignment.
 * Precedence: Individual Student Override > Section Override > Base Assignment Dates.
 */
export async function resolveStudentEffectiveDates(
  assignment: AssignmentDateSource,
  userId: string,
  courseId: string,
  tx: PrismaClient | typeof prisma = prisma
): Promise<EffectiveAssignmentDates> {
  const client = (tx as any) || prisma
  // 1. Check for individual student override
  // Note: We MUST exclude CBTF exam slot overrides because they represent
  // scheduled testing session access windows rather than assignment/section deadline policies.
  const cbtfReservations =
    typeof client.cbtfReservation?.findMany === 'function'
      ? await client.cbtfReservation.findMany({
          where: {
            userId,
            assignmentId: assignment.id,
            canvasOverrideId: { not: null }
          },
          select: { canvasOverrideId: true }
        })
      : []
  const cbtfOverrideCanvasIds = cbtfReservations
    .map((r) => r.canvasOverrideId)
    .filter((id): id is string => Boolean(id))

  const studentOverride = await client.assignmentOverrideStudent.findFirst({
    where: {
      userId,
      override: {
        assignmentId: assignment.id,
        NOT: [
          { title: { equals: 'CBTF Exam Slot', mode: 'insensitive' } },
          { title: { startsWith: 'CBTF', mode: 'insensitive' } },
          ...(cbtfOverrideCanvasIds.length > 0
            ? [{ canvasOverrideId: { in: cbtfOverrideCanvasIds } }]
            : [])
        ]
      }
    },
    include: { override: true }
  })

  if (studentOverride?.override) {
    const o = studentOverride.override
    return {
      availableFrom: o.availableFrom ?? assignment.availableFrom ?? null,
      dueDate: o.dueDate ?? assignment.dueDate ?? null,
      acceptUntil: o.acceptUntil ?? assignment.acceptUntil ?? null,
      overrideType: 'STUDENT',
      overrideTitle: o.title ?? null
    }
  }

  // 2. Check for section-level override
  const enrollment = await client.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { courseSectionId: true }
  })

  if (enrollment?.courseSectionId) {
    const sectionOverride = await client.assignmentOverride.findFirst({
      where: {
        assignmentId: assignment.id,
        courseSectionId: enrollment.courseSectionId
      }
    })

    if (sectionOverride) {
      return {
        availableFrom: sectionOverride.availableFrom ?? assignment.availableFrom ?? null,
        dueDate: sectionOverride.dueDate ?? assignment.dueDate ?? null,
        acceptUntil: sectionOverride.acceptUntil ?? assignment.acceptUntil ?? null,
        overrideType: 'SECTION',
        overrideTitle: sectionOverride.title ?? null
      }
    }
  }

  // 3. Fallback to default base assignment dates
  return {
    availableFrom: assignment.availableFrom ?? null,
    dueDate: assignment.dueDate ?? null,
    acceptUntil: assignment.acceptUntil ?? null,
    overrideType: 'NONE',
    overrideTitle: null
  }
}
