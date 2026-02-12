import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export interface RedemptionRow {
    id: string
    assignmentTitle: string | null
    redeemedAt: string
    cost: number
    hoursPerPass: number
    availableFrom: string | null
    acceptUntil: string | null
    isActive: boolean
    [key: string]: any
}

export default defineEventHandler(async (event): Promise<ApiResponse<RedemptionRow[]>> => {
    const session = await getUserSession(event)

    if (!session.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized'
        })
    }

    // Get current course context from user session or DB
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { currentCourseId: true }
    })

    const courseId = user?.currentCourseId

    if (!courseId) {
        return {
            statusCode: 200,
            data: []
        }
    }

    // Fetch redemptions for the current user in the current course
    const redemptions = await prisma.passRedemption.findMany({
        where: {
            pool: {
                userId: session.user.id,
                passType: {
                    courseId: courseId
                }
            }
        },
        orderBy: {
            redeemedAt: 'desc'
        },
        include: {
            assignment: {
                select: { title: true }
            },
            pool: {
                include: {
                    passType: {
                        select: { hoursPerPass: true }
                    }
                }
            }
        }
    })

    const now = new Date()

    const data: RedemptionRow[] = redemptions.map((r) => {
        const isActive = (() => {
            // Logic for "isActive": current time is between availableFrom and acceptUntil
            if (!r.availableFrom || !r.acceptUntil) return false
            return now >= r.availableFrom && now <= r.acceptUntil
        })()

        return {
            id: r.id,
            assignmentTitle: r.assignment.title,
            redeemedAt: r.redeemedAt.toISOString(),
            cost: r.cost,
            hoursPerPass: r.pool.passType.hoursPerPass,
            availableFrom: r.availableFrom?.toISOString() ?? null,
            acceptUntil: r.acceptUntil?.toISOString() ?? null,
            isActive
        }
    })

    return {
        statusCode: 200,
        data
    }
})
