import prisma from '@@/server/utils/db'
import type {
  AssignmentRedemptionRow,
  StudentRosterRow,
  StudentRedemptionHistoryRow,
  StudentInterviewHistoryRow
} from '@@/shared/models/teacher'
import type { AssignmentOverrideDetails } from '@@/shared/models/override'
import type { CourseSectionRow } from '@@/shared/models/section'
import type { CbtfReservationDto, CbtfAssignmentReservationSummary } from '@@/shared/models/cbtf'
import {
  toCbtfReservationDto,
  autoExpirePastScheduledReservations,
  getPrimaryCbtfFacility,
  getFacilityTimezone,
  getFacilityOperatingHoursForDate,
  generateAvailableSlotsForDate
} from '@@/server/utils/cbtf'
import { getLocalDateString, combineDateAndTime } from '@@/shared/utils/timezone'

/**
 * Retrieves all redemptions for a specific assignment in a course.
 */
export async function getAssignmentRedemptions(
  assignmentId: string,
  courseId: string
): Promise<AssignmentRedemptionRow[]> {
  const redemptions = await prisma.passRedemption.findMany({
    where: {
      assignmentId,
      assignment: { courseId }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      assignment: { select: { id: true, title: true } },
      pool: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              enrollments: {
                where: { courseId },
                include: { courseSection: true }
              }
            }
          },
          passType: { select: { name: true, hoursPerPass: true } }
        }
      }
    }
  })

  const now = new Date()

  return redemptions.map((r) => {
    const student = r.pool.user
    const studentName =
      [student.firstName, student.lastName].filter(Boolean).join(' ').trim() || 'Unknown Student'
    const sectionName = student.enrollments[0]?.courseSection?.name ?? null

    const isActive = (() => {
      if (r.acceptUntil) return now <= r.acceptUntil
      if (r.dueDate) return now <= r.dueDate
      return false
    })()

    return {
      id: r.id,
      assignmentId: r.assignment.id,
      assignmentTitle: r.assignment.title,
      studentId: student.id,
      studentName,
      studentEmail:
        student.email && !student.email.endsWith('@synthetic.canvas.local') ? student.email : null,
      sectionName,
      passTypeName: r.pool.passType.name,
      cost: r.cost,
      hoursPerPass: r.pool.passType.hoursPerPass,
      redeemedAt: r.createdAt.toISOString(),
      dueDate: r.dueDate?.toISOString() ?? null,
      acceptUntil: r.acceptUntil?.toISOString() ?? null,
      isActive
    }
  })
}

/**
 * Retrieves the enrolled student roster with pass balances and total redemptions for a course.
 */
export async function getCourseStudentRoster(courseId: string): Promise<StudentRosterRow[]> {
  // 1. Fetch all pass types configured for the course
  const passTypes = await prisma.passType.findMany({
    where: { courseId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, initialBalance: true }
  })

  // 2. Fetch all student enrollments with user, section, pass pools, and redemptions
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      role: 'STUDENT'
    },
    include: {
      courseSection: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          passPools: {
            where: { passType: { courseId } },
            include: { passType: true, redemptions: true }
          }
        }
      }
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }]
  })

  return enrollments.map((en) => {
    const user = en.user
    const studentName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Unknown Student'
    const sectionName = en.courseSection?.name ?? null

    // Compute pass balance for each pass type in the course
    const passBalances = passTypes.map((pt) => {
      const pool = user.passPools.find((p) => p.passTypeId === pt.id)
      return {
        passTypeId: pt.id,
        passTypeName: pt.name,
        balance: pool ? pool.balance : pt.initialBalance,
        initialBalance: pt.initialBalance
      }
    })

    // Count total redemptions across all pools for this course
    const totalRedemptions = user.passPools.reduce((acc, p) => acc + p.redemptions.length, 0)

    return {
      userId: user.id,
      studentName,
      studentEmail:
        user.email && !user.email.endsWith('@synthetic.canvas.local') ? user.email : null,
      sectionName,
      passBalances,
      totalRedemptions
    }
  })
}

/**
 * Retrieves all pass redemptions for a specific student in a course.
 */
export async function getStudentRedemptionHistory(
  studentId: string,
  courseId: string
): Promise<StudentRedemptionHistoryRow[]> {
  const redemptions = await prisma.passRedemption.findMany({
    where: {
      pool: {
        userId: studentId,
        passType: { courseId }
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      assignment: { select: { id: true, title: true } },
      pool: {
        include: {
          passType: { select: { name: true, hoursPerPass: true, extensionOnly: true } }
        }
      }
    }
  })

  const now = new Date()

  return redemptions.map((r) => {
    const isActive = (() => {
      if (r.acceptUntil) return now <= r.acceptUntil
      if (r.dueDate) return now <= r.dueDate
      return false
    })()

    return {
      id: r.id,
      assignmentId: r.assignment.id,
      assignmentTitle: r.assignment.title,
      passTypeName: r.pool.passType.name,
      cost: r.cost,
      hoursPerPass: r.pool.passType.hoursPerPass,
      extensionOnly: r.pool.passType.extensionOnly,
      createdAt: r.createdAt.toISOString(),
      redeemedAt: r.createdAt.toISOString(),
      dueDate: r.dueDate?.toISOString() ?? null,
      acceptUntil: r.acceptUntil?.toISOString() ?? null,
      isActive
    }
  })
}

/**
 * Retrieves all section and individual overrides for a specific assignment.
 */
export async function getAssignmentOverrides(
  assignmentId: string,
  courseId: string
): Promise<AssignmentOverrideDetails[]> {
  const overrides = await prisma.assignmentOverride.findMany({
    where: {
      assignmentId,
      assignment: { courseId }
    },
    include: {
      courseSection: true,
      studentOverrides: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  return overrides.map((o) => {
    const isSection = !!o.courseSectionId
    let targetName = 'General'
    if (isSection && o.courseSection) {
      targetName = `Section: ${o.courseSection.name}`
    } else if (o.studentOverrides && o.studentOverrides.length > 0) {
      const studentLabels = o.studentOverrides
        .map((s) => {
          const name =
            [s.user.firstName, s.user.lastName].filter(Boolean).join(' ').trim() ||
            s.user.email ||
            s.user.id
          return name
        })
        .join(', ')
      targetName = `Student(s): ${studentLabels}`
    }

    return {
      id: o.id,
      title: o.title ?? null,
      type: isSection ? ('SECTION' as const) : ('STUDENT' as const),
      targetName,
      availableFrom: o.availableFrom?.toISOString() ?? null,
      dueDate: o.dueDate?.toISOString() ?? null,
      acceptUntil: o.acceptUntil?.toISOString() ?? null
    }
  })
}

/**
 * Retrieves all sections for a course along with enrolled student counts and override counts.
 */
export async function getCourseSections(courseId: string): Promise<CourseSectionRow[]> {
  const sections = await prisma.courseSection.findMany({
    where: { courseId },
    include: {
      _count: {
        select: {
          enrollments: {
            where: {
              role: 'STUDENT'
            }
          },
          overrides: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  return sections.map((s) => ({
    id: s.id,
    name: s.name,
    canvasSectionId: s.canvasSectionId,
    totalStudents: s._count.enrollments,
    totalOverrides: s._count.overrides
  }))
}

/**
 * Retrieves all GTA interview reservations for a specific student in a course.
 */
export async function getStudentInterviewHistory(
  studentId: string,
  courseId: string
): Promise<StudentInterviewHistoryRow[]> {
  const reservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      studentId,
      assignment: { courseId }
    },
    orderBy: { startTime: 'desc' },
    include: {
      assignment: { select: { id: true, title: true } },
      gta: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  return reservations.map((r) => ({
    id: r.id,
    assignmentId: r.assignment.id,
    assignmentTitle: r.assignment.title || 'Untitled Assignment',
    gtaId: r.gtaId,
    gtaName:
      [r.gta?.firstName, r.gta?.lastName].filter(Boolean).join(' ').trim() ||
      r.gta?.email ||
      'Unknown GTA',
    gtaEmail: r.gta?.email || null,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    status: r.status,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString()
  }))
}

/**
 * Retrieves all CBTF reservations for a specific student in a course.
 */
export async function getStudentCbtfReservations(
  studentId: string,
  courseId: string
): Promise<CbtfReservationDto[]> {
  await autoExpirePastScheduledReservations({ userId: studentId })

  const reservations = await prisma.cbtfReservation.findMany({
    where: {
      userId: studentId,
      assignment: { courseId }
    },
    include: {
      assignment: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
    },
    orderBy: { startTime: 'desc' }
  })

  return reservations.map(toCbtfReservationDto)
}

/**
 * Retrieves summary metrics of CBTF reservations for a given assignment across enrolled students,
 * including remaining open reservation slots (seats) through the end of the assignment's reservation window.
 */
export async function getCbtfAssignmentReservationSummary(
  assignmentId: string,
  courseId: string
): Promise<CbtfAssignmentReservationSummary> {
  await autoExpirePastScheduledReservations()

  const [assignment, studentEnrollments, reservations] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        courseId: true,
        isSchedulable: true,
        scheduleWindowStart: true,
        scheduleWindowEnd: true,
        availableFrom: true,
        dueDate: true,
        acceptUntil: true,
        overrides: {
          select: {
            availableFrom: true,
            dueDate: true,
            acceptUntil: true
          }
        }
      }
    }),
    prisma.enrollment.findMany({
      where: {
        courseId,
        courseRole: 'STUDENT',
        dropped: false
      },
      select: { userId: true }
    }),
    prisma.cbtfReservation.findMany({
      where: {
        assignmentId,
        assignment: { courseId }
      },
      select: {
        userId: true,
        status: true
      }
    })
  ])

  const enrolledStudentIds = new Set(studentEnrollments.map((e) => e.userId))
  const allStudentIds = new Set<string>([
    ...enrolledStudentIds,
    ...reservations.map((r) => r.userId)
  ])

  const userReservationsMap = new Map<string, string[]>()
  for (const r of reservations) {
    if (!userReservationsMap.has(r.userId)) {
      userReservationsMap.set(r.userId, [])
    }
    userReservationsMap.get(r.userId)!.push(r.status)
  }

  let completedCount = 0
  let scheduledCount = 0
  let unscheduledCount = 0

  for (const userId of allStudentIds) {
    const statuses = userReservationsMap.get(userId) || []

    if (statuses.some((s) => s === 'COMPLETED' || s === 'CHECKED_OUT')) {
      completedCount++
    } else if (statuses.some((s) => s === 'SCHEDULED' || s === 'CHECKED_IN')) {
      scheduledCount++
    } else {
      unscheduledCount++
    }
  }

  const totalEnrolledCount = allStudentIds.size
  const completedPct =
    totalEnrolledCount > 0 ? Number(((completedCount / totalEnrolledCount) * 100).toFixed(1)) : 0
  const scheduledPct =
    totalEnrolledCount > 0 ? Number(((scheduledCount / totalEnrolledCount) * 100).toFixed(1)) : 0
  const unscheduledPct =
    totalEnrolledCount > 0 ? Number(((unscheduledCount / totalEnrolledCount) * 100).toFixed(1)) : 0

  // Calculate remaining open reservation slots (seats) through end of reservation window
  let remainingOpenSlots = 0
  let remainingOpenSeats = 0
  let reservationWindowEnd: string | null = null

  if (assignment?.isSchedulable) {
    let windowEnd: Date | null =
      assignment.scheduleWindowEnd || assignment.acceptUntil || assignment.dueDate || null

    if (assignment.overrides && assignment.overrides.length > 0) {
      for (const o of assignment.overrides) {
        const overrideEnd = o.acceptUntil || o.dueDate
        if (overrideEnd && (!windowEnd || overrideEnd > windowEnd)) {
          windowEnd = overrideEnd
        }
      }
    }

    if (windowEnd) {
      reservationWindowEnd = windowEnd.toISOString()
    }

    const now = new Date()
    // CBTF advance notice invariant: reservations must be scheduled at least 15 min in advance
    const advanceNoticeStart = new Date(now.getTime() + 15 * 60 * 1000)
    const windowStart = assignment.scheduleWindowStart || assignment.availableFrom || null
    const searchStart =
      windowStart && windowStart.getTime() > advanceNoticeStart.getTime()
        ? windowStart
        : advanceNoticeStart

    if (windowEnd && searchStart.getTime() < windowEnd.getTime()) {
      const facility = await getPrimaryCbtfFacility()
      const timeZone = getFacilityTimezone(facility)

      // Fetch active reservations in the facility across the remaining window
      const facilityReservations = await prisma.cbtfReservation.findMany({
        where: {
          facilityId: facility.id,
          status: { in: ['SCHEDULED', 'CHECKED_IN'] },
          endTime: { gte: searchStart },
          startTime: { lte: windowEnd }
        },
        select: {
          startTime: true,
          endTime: true,
          seatNumber: true
        }
      })

      const localStartDateStr = getLocalDateString(searchStart, timeZone)
      const localEndDateStr = getLocalDateString(windowEnd, timeZone)
      const startParts = localStartDateStr.split('-').map(Number)
      const cursorDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]))
      const maxDays = 90
      let daysScanned = 0

      while (daysScanned < maxDays) {
        daysScanned++
        const dateStr = cursorDate.toISOString().split('T')[0]
        if (dateStr > localEndDateStr) {
          break
        }

        const dayStartUtc = combineDateAndTime(dateStr, '00:00', timeZone)
        const dayEndUtc = combineDateAndTime(dateStr, '23:59:59.999', timeZone)

        const hours = await getFacilityOperatingHoursForDate(
          facility.id,
          dayStartUtc,
          prisma,
          timeZone
        )

        if (hours.isOpen && hours.openTime && hours.closeTime) {
          const dayReservations = facilityReservations.filter(
            (r) => r.startTime <= dayEndUtc && r.endTime >= dayStartUtc
          )

          const daySlots = generateAvailableSlotsForDate(
            facility,
            dayStartUtc,
            hours,
            dayReservations,
            timeZone
          )

          const minStartMs = searchStart.getTime()
          const maxEndMs = windowEnd.getTime()

          for (const slot of daySlots) {
            if (slot.startTime.getTime() >= minStartMs && slot.endTime.getTime() <= maxEndMs) {
              remainingOpenSlots++
              const openSeats = Math.min(
                slot.maxArrivals - slot.arrivalsCount,
                slot.totalSeats - slot.occupiedSeatsCount
              )
              remainingOpenSeats += Math.max(0, openSeats)
            }
          }
        }

        cursorDate.setUTCDate(cursorDate.getUTCDate() + 1)
      }
    }
  }

  return {
    totalEnrolledCount,
    completedCount,
    scheduledCount,
    unscheduledCount,
    completedPct,
    scheduledPct,
    unscheduledPct,
    remainingOpenSlots,
    remainingOpenSeats,
    reservationWindowEnd
  }
}
