import prisma from '@@/lib/prisma'
import type { PassTypeData } from '@@/shared/models/pass'

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
