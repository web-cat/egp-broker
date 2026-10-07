import type { AssignmentRow } from '../models/assignment'

export interface AssignmentFilterCriteria {
  published?: boolean
  unpublished?: boolean
  active?: boolean
  expired?: boolean
  cbtf?: boolean
  interviews?: boolean
  standard?: boolean
}

export const DEFAULT_ASSIGNMENT_FILTERS: Required<AssignmentFilterCriteria> = {
  published: true,
  unpublished: true,
  active: true,
  expired: true,
  cbtf: true,
  interviews: true,
  standard: true
}

/**
 * Determines whether an assignment is expired for all students.
 * An assignment is expired when its hard available-until cutoff date has passed.
 * - If acceptUntil is set: expired when acceptUntil < now.
 * - Otherwise if scheduleWindowEnd is set: expired when scheduleWindowEnd < now.
 * - Otherwise if interviewWindowEnd is set: expired when interviewWindowEnd < now.
 * - Otherwise if dueDate is set: expired when dueDate < now.
 * - If none of these dates are present, the assignment never expires.
 */
export function isAssignmentExpired(
  assignment: Pick<
    AssignmentRow,
    'acceptUntil' | 'dueDate' | 'scheduleWindowEnd' | 'interviewWindowEnd'
  >,
  now = new Date()
): boolean {
  if (assignment.acceptUntil) {
    return new Date(assignment.acceptUntil) < now
  }
  if (assignment.scheduleWindowEnd) {
    return new Date(assignment.scheduleWindowEnd) < now
  }
  if (assignment.interviewWindowEnd) {
    return new Date(assignment.interviewWindowEnd) < now
  }
  if (assignment.dueDate) {
    return new Date(assignment.dueDate) < now
  }
  return false
}

/**
 * Filters a list of assignment rows based on teacher dashboard filter criteria.
 */
export function filterTeacherAssignments(
  assignments: AssignmentRow[],
  filters: AssignmentFilterCriteria = DEFAULT_ASSIGNMENT_FILTERS,
  now = new Date()
): AssignmentRow[] {
  const mergedFilters: Required<AssignmentFilterCriteria> = {
    ...DEFAULT_ASSIGNMENT_FILTERS,
    ...filters
  }

  return assignments.filter((a) => {
    // 1. Publication status filter
    const isPub = a.published !== false
    if (isPub && !mergedFilters.published) return false
    if (!isPub && !mergedFilters.unpublished) return false

    // 2. Expiration filter
    const expired = isAssignmentExpired(a, now)
    if (expired && !mergedFilters.expired) return false
    if (!expired && !mergedFilters.active) return false

    // 3. Modality filter
    const isCbtf = Boolean(a.isSchedulable)
    const isGta = Boolean(a.hasInterviews)
    const isStandard = !isCbtf && !isGta

    const matchesModality =
      (isCbtf && mergedFilters.cbtf) ||
      (isGta && mergedFilters.interviews) ||
      (isStandard && mergedFilters.standard)

    if (!matchesModality) return false

    return true
  })
}
