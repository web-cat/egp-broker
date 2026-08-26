import prisma from '@@/server/utils/db'
import type {
  AssignmentRedemptionRow,
  StudentRosterRow,
  StudentRedemptionHistoryRow
} from '@@/shared/models/teacher'

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
      if (r.dueDate) return now <= r.dueDate
      if (r.acceptUntil) return now <= r.acceptUntil
      return false
    })()

    return {
      id: r.id,
      assignmentId: r.assignment.id,
      assignmentTitle: r.assignment.title,
      studentId: student.id,
      studentName,
      studentEmail: student.email,
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
      studentEmail: user.email,
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
          passType: { select: { name: true, hoursPerPass: true } }
        }
      }
    }
  })

  const now = new Date()

  return redemptions.map((r) => {
    const isActive = (() => {
      if (r.dueDate) return now <= r.dueDate
      if (r.acceptUntil) return now <= r.acceptUntil
      return false
    })()

    return {
      id: r.id,
      assignmentId: r.assignment.id,
      assignmentTitle: r.assignment.title,
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
