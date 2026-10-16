import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import {
  formatSlotsToShiftString,
  type ParsedShiftSlot
} from '@@/shared/utils/proctor-schedule-parser'
import type { ApiResponse } from '@@/shared/types/api'

export interface CourseGtaDto {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  shiftDefinition?: string | null
}

export default defineEventHandler(async (event): Promise<ApiResponse<CourseGtaDto[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions to view course teaching assistants'
    })
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      role: 'TA'
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }]
  })

  const gtas: CourseGtaDto[] = enrollments.map((e) => ({
    id: e.user.id,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    email: e.user.email,
    avatarUrl: e.user.avatarUrl,
    shiftDefinition: e.shiftDefinition ?? null
  }))

  // For any GTA without a stored shiftDefinition, check if they already have existing shifts in the course
  // to auto-derive their most recent recurring weekly shift list
  const gtasNeedingShiftDef = gtas.filter((g) => !g.shiftDefinition)
  if (gtasNeedingShiftDef.length > 0 && prisma.gtaShift) {
    const existingShifts = await prisma.gtaShift.findMany({
      where: {
        courseId,
        userId: { in: gtasNeedingShiftDef.map((g) => g.id) }
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }]
    })

    if (existingShifts && existingShifts.length > 0) {
      const shiftsByGta = new Map<string, typeof existingShifts>()
      for (const s of existingShifts) {
        const list = shiftsByGta.get(s.userId) || []
        list.push(s)
        shiftsByGta.set(s.userId, list)
      }

      for (const gta of gtasNeedingShiftDef) {
        const userShifts = shiftsByGta.get(gta.id)
        if (userShifts && userShifts.length > 0) {
          const seenSlotKeys = new Set<string>()
          const slots: ParsedShiftSlot[] = []

          for (const s of userShifts) {
            const dayOfWeek = new Date(s.date).getUTCDay()
            const key = `${dayOfWeek}:${s.startTime}-${s.endTime}`
            if (!seenSlotKeys.has(key)) {
              seenSlotKeys.add(key)
              slots.push({
                dayOfWeek,
                dayName: '',
                startTime: s.startTime,
                endTime: s.endTime,
                durationHours: 0
              })
            }
          }

          if (slots.length > 0) {
            gta.shiftDefinition = formatSlotsToShiftString(slots)
          }
        }
      }
    }
  }

  return {
    statusCode: 200,
    data: gtas
  }
})
