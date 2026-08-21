import prisma from '@@/server/utils/db'
import type { AssignmentRow, CreateAssignmentData } from '@@/shared/models/assignment'

/**
 * Creates a new assignment.
 */

/**
 * Checks if an assignment title matches a given regex pattern.
 * Safely handles invalid regex patterns by logging the error and returning false.
 */
export function matchesTitlePattern(pattern: string, title: string): boolean {
  if (!pattern || !title) return false

  try {
    const regex = new RegExp(`${pattern}`, 'i')
    return regex.test(title)
  } catch (e) {
    console.error(`Invalid regex pattern: ${pattern}`, e)
    return false
  }
}

/**
 * Recalculates `eligibleFrom` and `eligibleUntil` for a given assignment based on its pass eligibilities.
 *
 * Rules:
 * - eligibleFrom = MIN(dueDate + minDaysPastDue) across all eligible pass types.
 *   - If minDaysPastDue is null, treat as 0.
 *   - If dueDate is null, result is null.
 *
 * - eligibleUntil = MAX(dueDate + maxDaysPastDue) across all eligible pass types.
 *   - If ANY eligible pass type has maxDaysPastDue == null (infinite), result is null (infinite).
 *
 * @param assignmentId ID of the assignment to update
 * @param tx Optional transaction client (uses global prisma if not provided)
 */
export async function recalculateAssignmentEligibleDates(assignmentId: string, tx: any = prisma) {
  const assignment = await tx.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      passEligibilities: {
        include: { passType: true }
      }
    }
  })

  if (!assignment || !assignment.dueDate) {
    // If no assignment or no due date, we can't calculate offsets.
    // Reset to null.
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { eligibleFrom: null, eligibleUntil: null }
    })
    return
  }

  const eligibilities = assignment.passEligibilities

  if (eligibilities.length === 0) {
    // No eligibilities -> No extension possible.
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { eligibleFrom: null, eligibleUntil: null }
    })
    return
  }

  let minFrom: Date | null = null
  let maxUntil: Date | null = null
  let isUntilInfinite = false

  for (const e of eligibilities) {
    const pt = e.passType

    // --- Calculate From Date ---
    // minDaysPastDue default 0
    const minDays = pt.minDaysPastDue ?? 0
    const fromDate = new Date(assignment.dueDate.getTime() + minDays * 24 * 60 * 60 * 1000)

    if (minFrom === null || fromDate < minFrom) {
      minFrom = fromDate
    }

    // --- Calculate Until Date ---
    if (pt.maxDaysPastDue === null) {
      // One pass type allows infinite extension -> Agreement is infinite
      isUntilInfinite = true
    } else if (!isUntilInfinite) {
      const maxDays = pt.maxDaysPastDue
      const untilDate = new Date(assignment.dueDate.getTime() + maxDays * 24 * 60 * 60 * 1000)

      if (maxUntil === null || untilDate > maxUntil) {
        maxUntil = untilDate
      }
    }
  }

  // If infinite, eligibleUntil is null
  const finalUntil = isUntilInfinite ? null : maxUntil

  await tx.assignment.update({
    where: { id: assignmentId },
    data: {
      eligibleFrom: minFrom,
      eligibleUntil: finalUntil
    }
  })
}

/**
 * Synchronizes the eligibility of an assignment for various pass types based on pattern matching.
 */
export async function syncAssignmentEligibility(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, title: true, courseId: true }
  })

  if (!assignment || !assignment.title) return

  // Fetch all pass types for the course
  const passTypes = await prisma.passType.findMany({
    where: { courseId: assignment.courseId }
  })

  // Fetch all existing eligibility records for this assignment
  const existingEligibilities = await prisma.passEligibility.findMany({
    where: { assignmentId },
    select: { id: true, passTypeId: true, isAutomatic: true }
  })

  const eligibilityMap = new Map(existingEligibilities.map((e) => [e.passTypeId, e]))

  const operations = []

  for (const pt of passTypes) {
    let matches = false

    if (pt.titlePattern) {
      matches = matchesTitlePattern(pt.titlePattern, assignment.title)
    }

    const existing = eligibilityMap.get(pt.id)

    if (matches) {
      if (!existing) {
        // Create new automatic eligibility
        operations.push(
          prisma.passEligibility.create({
            data: {
              passTypeId: pt.id,
              assignmentId: assignment.id,
              isAutomatic: true
            }
          })
        )
      }
      // If matches and existing, do NOT update. Preserve valid existing link.
    } else {
      if (existing && existing.isAutomatic) {
        // Remove automatic eligibility that no longer matches
        operations.push(
          prisma.passEligibility.delete({
            where: { id: existing.id }
          })
        )
      }
      // If not matching and existing is manual (isAutomatic: false), preserve it.
    }
  }

  // Execute operations in transaction
  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  // Recalculate dates if we changed eligibilities, OR if we just want to ensure consistency.
  // Ideally we do it in the transaction, but our helper is distinct.
  // It's safer to just run it.
  await recalculateAssignmentEligibleDates(assignmentId)
}

/**
 * Synchronizes a specific pass type with all assignments in its course.
 * Used when a pass type is created or updated.
 */
export async function syncPassTypeEligibility(passTypeId: string) {
  const passType = await prisma.passType.findUnique({
    where: { id: passTypeId },
    include: { course: { include: { assignments: true } } }
  })

  if (!passType) return

  const assignments = passType.course.assignments
  const operations: any[] = []
  const affectedAssignmentIds = new Set<string>()

  // If no pattern, we should remove ALL automatic eligibilities for this pass type
  if (!passType.titlePattern) {
    const autoEligibilities = await prisma.passEligibility.findMany({
      where: {
        passTypeId: passType.id,
        isAutomatic: true
      },
      select: { id: true, assignmentId: true }
    })

    if (autoEligibilities.length > 0) {
      // Mark all affected assignments
      autoEligibilities.forEach((e) => {
        if (e.assignmentId) affectedAssignmentIds.add(e.assignmentId)
      })

      // Delete eligibilities
      await prisma.passEligibility.deleteMany({
        where: {
          id: { in: autoEligibilities.map((e) => e.id) }
        }
      })
    }
  } else {
    // Pattern exists, sync logic
    const existingEligibilities = await prisma.passEligibility.findMany({
      where: { passTypeId: passType.id },
      select: { id: true, assignmentId: true, isAutomatic: true }
    })

    const eligibilityMap = new Map(existingEligibilities.map((e) => [e.assignmentId, e]))

    for (const assignment of assignments) {
      if (!assignment.title) continue

      const matches = matchesTitlePattern(passType.titlePattern, assignment.title)
      const existing = eligibilityMap.get(assignment.id)

      if (matches) {
        if (!existing) {
          operations.push(
            prisma.passEligibility.create({
              data: {
                passTypeId: passType.id,
                assignmentId: assignment.id,
                isAutomatic: true
              }
            })
          )
          affectedAssignmentIds.add(assignment.id)
        }
      } else {
        if (existing && existing.isAutomatic) {
          operations.push(
            prisma.passEligibility.delete({
              where: { id: existing.id }
            })
          )
          affectedAssignmentIds.add(assignment.id!) // assignmentId should be present
        }
      }
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  // Recalculate dates for ALL affected assignments
  for (const assignmentId of affectedAssignmentIds) {
    await recalculateAssignmentEligibleDates(assignmentId)
  }
}

/**
 * Fetches all assignments for a course with their pass eligibilities.
 * strictly conforms to the `AssignmentRow` shared schema.
 */
export async function getCourseAssignments(courseId: string): Promise<AssignmentRow[]> {
  const assignments = await prisma.assignment.findMany({
    where: { courseId },
    orderBy: [{ dueDate: 'desc' }, { title: 'asc' }],
    include: {
      course: { select: { label: true, title: true } },
      passEligibilities: {
        include: { passType: true }
      }
    }
  })

  return assignments.map((a) => ({
    id: a.id,
    resourceLinkId: a.resourceLinkId,
    title: a.title ?? null,
    canvasAssignmentId: a.canvasAssignmentId ?? null,
    courseLabel: a.course.label ?? null,
    courseTitle: a.course.title ?? null,
    dueDate: a.dueDate?.toISOString() ?? null,
    availableFrom: a.availableFrom?.toISOString() ?? null,
    acceptUntil: a.acceptUntil?.toISOString() ?? null,
    eligibleUntil: a.eligibleUntil?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    eligiblePassTypeNames: a.passEligibilities.map((pe) => pe.passType.name),
    eligiblePassTypes: a.passEligibilities.map((pe) => ({
      id: pe.passType.id,
      name: pe.passType.name
    })),
    eligibilities: a.passEligibilities.map((pe) => ({
      passTypeId: pe.passType.id,
      passTypeName: pe.passType.name,
      isAutomatic: pe.isAutomatic
    }))
  }))
}

/**
 * Sets the manual (non-automatic) pass type eligibilities for an assignment.
 * - Removes manual eligibilities whose passTypeId is NOT in the new list.
 * - Creates new manual eligibilities for pass types not yet linked.
 * - Does NOT touch automatic eligibilities.
 * - Recalculates eligible dates afterward.
 */
export async function setManualEligibilities(assignmentId: string, manualPassTypeIds: string[]) {
  const existing = await prisma.passEligibility.findMany({
    where: { assignmentId },
    select: { id: true, passTypeId: true, isAutomatic: true }
  })

  const operations = []

  // Remove manual eligibilities no longer in the list
  for (const e of existing) {
    if (!e.isAutomatic && !manualPassTypeIds.includes(e.passTypeId)) {
      operations.push(prisma.passEligibility.delete({ where: { id: e.id } }))
    }
  }

  // Create new manual eligibilities for IDs not already linked (auto or manual)
  const existingPassTypeIds = new Set(existing.map((e) => e.passTypeId))
  for (const ptId of manualPassTypeIds) {
    if (!existingPassTypeIds.has(ptId)) {
      operations.push(
        prisma.passEligibility.create({
          data: {
            passTypeId: ptId,
            assignmentId,
            isAutomatic: false
          }
        })
      )
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  await recalculateAssignmentEligibleDates(assignmentId)
}

export async function createAssignment(data: CreateAssignmentData) {
  const assignment = await prisma.assignment.create({
    data: {
      resourceLinkId: `manual-${Date.now()}`,
      title: data.title,
      canvasAssignmentId: data.canvasAssignmentId,
      courseId: data.courseId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
      acceptUntil: data.acceptUntil ? new Date(data.acceptUntil) : null
    }
  })

  // Sync automatic pass eligibility
  await syncAssignmentEligibility(assignment.id)

  return assignment
}

export async function deleteAssignment(id: string) {
  return await prisma.$transaction(async (tx) => {
    // Delete any dependent records if needed (like LtiResult which lacks cascade onDelete)
    await tx.ltiResult.deleteMany({
      where: { assignmentId: id }
    })

    return await tx.assignment.delete({
      where: { id }
    })
  })
}
