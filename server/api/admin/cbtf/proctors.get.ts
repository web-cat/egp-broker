import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import {
  formatSlotsToShiftString,
  type ParsedShiftSlot
} from '@@/shared/utils/proctor-schedule-parser'
import type { ApiResponse } from '@@/shared/types/api'

export interface CbtfProctorUserDto {
  id: string
  firstName: string
  lastName: string
  email: string
  globalRole: string
  avatarUrl: string | null
  proctorShiftDefinition: string | null
}

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfProctorUserDto[]>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const proctorsRaw = await prisma.user.findMany({
    where: { globalRole: 'PROCTOR' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      globalRole: true,
      avatarUrl: true,
      proctorShiftDefinition: true
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  })

  const proctors: CbtfProctorUserDto[] = proctorsRaw.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    globalRole: p.globalRole,
    avatarUrl: p.avatarUrl,
    proctorShiftDefinition: p.proctorShiftDefinition ?? null
  }))

  const proctorsNeedingShiftDef = proctors.filter((p) => !p.proctorShiftDefinition)
  if (proctorsNeedingShiftDef.length > 0 && prisma.cbtfProctorShift) {
    const existingShifts = await prisma.cbtfProctorShift.findMany({
      where: {
        userId: { in: proctorsNeedingShiftDef.map((p) => p.id) }
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }]
    })

    if (existingShifts && existingShifts.length > 0) {
      const shiftsByProctor = new Map<string, typeof existingShifts>()
      for (const s of existingShifts) {
        const list = shiftsByProctor.get(s.userId) || []
        list.push(s)
        shiftsByProctor.set(s.userId, list)
      }

      for (const proctor of proctorsNeedingShiftDef) {
        const userShifts = shiftsByProctor.get(proctor.id)
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
            proctor.proctorShiftDefinition = formatSlotsToShiftString(slots)
          }
        }
      }
    }
  }

  return {
    statusCode: 200,
    data: proctors
  }
})
