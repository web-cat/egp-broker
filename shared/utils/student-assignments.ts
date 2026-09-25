import type { AssignmentRow } from '../models/assignment'

export interface FilterStudentAssignmentsOptions {
  assignments: AssignmentRow[]
  redemptions?: {
    assignmentId?: string
    assignmentTitle?: string | null
    acceptUntil?: string | null
    dueDate?: string | null
    createdAt?: string
    redeemedAt?: string
    extensionOnly?: boolean
  }[]
  getCbtfReservation?: (
    assignmentId: string
  ) => { status: string; endTime: string | Date } | null | undefined
  getGtaReservation?: (
    assignmentId: string
  ) => { status: string; endTime: string | Date } | null | undefined
  now?: Date
}

/**
 * Single source of truth for student assignment row visibility logic.
 * Used on both the Student Dashboard and the Teacher Student Detail modal.
 */
export function filterStudentAssignments(
  options: FilterStudentAssignmentsOptions
): AssignmentRow[] {
  const {
    assignments,
    redemptions = [],
    getCbtfReservation,
    getGtaReservation,
    now = new Date()
  } = options

  return assignments
    .filter((a) => {
      // 0. Published check: Hide if unpublished
      if (a.published === false) return false

      // 1. Availability check: Hide if not yet unlocked
      if (a.availableFrom && new Date(a.availableFrom) > now) return false

      // 2. Actionability check:
      // Must either be schedulable (CBTF/GTA) or have eligible pass types
      const hasPassTypes =
        (a.eligiblePassTypes && a.eligiblePassTypes.length > 0) ||
        (a.eligiblePassTypeNames && a.eligiblePassTypeNames.length > 0)
      if (!a.isSchedulable && !a.hasInterviews && !hasPassTypes) return false

      // 3. Active reservation check: Keep visible if student has an upcoming/active reservation
      const cbtfRes = getCbtfReservation?.(a.id)
      if (
        cbtfRes &&
        ['SCHEDULED', 'CHECKED_IN'].includes(cbtfRes.status) &&
        new Date(cbtfRes.endTime) >= now
      ) {
        return true
      }

      const gtaRes = getGtaReservation?.(a.id)
      if (
        gtaRes &&
        ['SCHEDULED', 'CHECKED_IN'].includes(gtaRes.status) &&
        new Date(gtaRes.endTime) >= now
      ) {
        return true
      }

      // 4. Active extension check: Keep visible if an extension is currently active
      const latestRedemption = redemptions.find(
        (r) =>
          (r.assignmentId && r.assignmentId === a.id) ||
          (r.assignmentTitle && r.assignmentTitle === a.title)
      )
      if (latestRedemption?.acceptUntil && new Date(latestRedemption.acceptUntil) > now) {
        return true
      }
      if (latestRedemption?.dueDate && new Date(latestRedemption.dueDate) > now) {
        return true
      }

      // 5. Initial window check:
      // Keep visible if not yet past accept until, due date, or scheduling windows
      if (a.acceptUntil && new Date(a.acceptUntil) > now) {
        return true
      }
      if (a.dueDate && new Date(a.dueDate) > now) {
        return true
      }
      if (a.isSchedulable && a.scheduleWindowEnd && new Date(a.scheduleWindowEnd) > now) {
        return true
      }
      if (a.hasInterviews && a.interviewWindowEnd && new Date(a.interviewWindowEnd) > now) {
        return true
      }

      // 6. Pass redemption window check:
      // If past accept until and due date, keep only if at least one pass type is still within its redemption window
      const passTypes = a.eligiblePassTypes || []
      if (passTypes.length > 0) {
        const hasOpenWindow = passTypes.some((pt) => {
          if (pt.maxDaysPastDue !== null && pt.maxDaysPastDue !== undefined) {
            const origDue = a.dueDate
              ? new Date(a.dueDate)
              : a.acceptUntil
                ? new Date(a.acceptUntil)
                : null
            if (!origDue) return false
            const maxAllowed = new Date(origDue.getTime() + pt.maxDaysPastDue * 24 * 60 * 60 * 1000)
            return now <= maxAllowed
          }
          if (a.eligibleUntil) return new Date(a.eligibleUntil) > now
          // If maxDaysPastDue is null/undefined and no eligibleUntil cutoff is specified,
          // it means there is no expiration limit for pass redemption
          return true
        })
        if (hasOpenWindow) return true
      } else if (a.eligibleUntil && new Date(a.eligibleUntil) > now) {
        return true
      }

      return false
    })
    .sort((a, b) => {
      // Keep assignments in chronological order by due date (earliest due date first, nulls last)
      if (!a.dueDate && !b.dueDate) return (a.title || '').localeCompare(b.title || '')
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .map((a) => ({
      ...a,
      highlight: true
    }))
}
