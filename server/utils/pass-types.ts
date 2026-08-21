import prisma from '@@/server/utils/db'
import type { PassTypeData, SimplePassPool } from '@@/shared/models/pass'
import { toSimplePassPool } from '@@/shared/models/pass'

/**
 * Retrieves pass pools for a student in a course.
 */

/**
 * Retrieves all pass types for a course, formatted as strict PassTypeData.
 */
export async function getCoursePassTypes(courseId: string): Promise<PassTypeData[]> {
  const passTypes = await prisma.passType.findMany({
    where: { courseId },
    orderBy: { name: 'asc' }
  })

  return passTypes.map((pt) => ({
    id: pt.id,
    name: pt.name,
    description: pt.description,
    extensionOnly: pt.extensionOnly,
    initialBalance: pt.initialBalance,
    allowRequests: pt.allowRequests,
    hoursPerPass: pt.hoursPerPass,
    titlePattern: pt.titlePattern,
    coolDownPeriod: pt.coolDownPeriod,
    coolDownUnit: pt.coolDownUnit,
    coolDownReset: pt.coolDownReset,
    coolDownResetOffset: pt.coolDownResetOffset,
    minDaysPastDue: pt.minDaysPastDue,
    maxDaysPastDue: pt.maxDaysPastDue,
    createdAt: pt.createdAt.toISOString()
  }))
}

export async function getStudentPassPools(
  userId: string,
  courseId: string
): Promise<SimplePassPool[]> {
  const pools = await prisma.studentPassPool.findMany({
    where: {
      userId,
      passType: { courseId }
    },
    include: {
      passType: true
    }
  })

  return pools.map(toSimplePassPool)
}
