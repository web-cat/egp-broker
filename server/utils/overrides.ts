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
  courseId: string
): Promise<EffectiveAssignmentDates> {
  // 1. Check for individual student override
  const studentOverride = await prisma.assignmentOverrideStudent.findFirst({
    where: {
      userId,
      override: { assignmentId: assignment.id }
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
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { courseSectionId: true }
  })

  if (enrollment?.courseSectionId) {
    const sectionOverride = await prisma.assignmentOverride.findFirst({
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
