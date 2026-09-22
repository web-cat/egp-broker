/**
 * CBTF (Computer-Based Testing Facility) Core Engine
 *
 * Algorithms for operating hours, 5-minute slot generation, arrival throttling,
 * sequential seat allocation, retake pass windows, and progressive narrowing.
 */

import { createError } from 'h3'
import type { PrismaClient } from '@prisma/client'
import prisma from '@@/server/utils/db'
import { resolveStudentEffectiveDates } from './overrides'
import { sendCbtfIncidentNotification } from './cbtf-notifications'
import type {
  CbtfFacility,
  CbtfReservation,
  CbtfRecommendedDay,
  CbtfHalfDayBlock,
  CbtfHourlySlotChoice,
  CbtfReservationDto
} from '@@/shared/models/cbtf'

import {
  DEFAULT_CBTF_TIMEZONE,
  getLocalDateString,
  extractCalendarDate,
  getLocalDayOfWeek,
  getLocalTimeParts,
  combineDateAndTime
} from '@@/shared/utils/timezone'

export interface FacilityOperatingHoursResult {
  isOpen: boolean
  openTime: string | null
  closeTime: string | null
  reason: string | null
}

export interface StudentSchedulingWindow {
  start: Date
  end: Date
  isPassWindow: boolean
  redemptionId: string | null
}

export interface SlotAvailability {
  startTime: Date
  endTime: Date
  arrivalsCount: number
  maxArrivals: number
  occupiedSeatsCount: number
  totalSeats: number
}

/**
 * Returns the primary CBTF testing facility.
 */
export async function getPrimaryCbtfFacility(
  tx: PrismaClient | typeof prisma = prisma
): Promise<CbtfFacility & { operatingHours: any[]; scheduleExceptions: any[] }> {
  let facility = await (tx as any).cbtfFacility.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      operatingHours: true,
      scheduleExceptions: true
    }
  })

  if (!facility) {
    // Auto-create default facility if none exists yet
    const seatOrder = Array.from({ length: 48 }, (_, i) => i + 1)
    facility = await (tx as any).cbtfFacility.create({
      data: {
        name: 'Main CBTF Facility',
        totalSeats: 48,
        seatAllocationOrder: seatOrder,
        operatingHours: {
          create: [
            { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
            { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
            { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
            { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
            { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00' }
          ]
        }
      },
      include: {
        operatingHours: true,
        scheduleExceptions: true
      }
    })
  }

  return facility
}

export function getFacilityTimezone(facility?: { timezone?: string | null }): string {
  return facility?.timezone || DEFAULT_CBTF_TIMEZONE
}

/**
 * Resolves facility operating hours for a specific calendar date, checking exceptions first.
 * Evaluates day of week and date boundaries in the facility's local timezone.
 */
export async function getFacilityOperatingHoursForDate(
  facilityId: string,
  targetDate: Date,
  tx: PrismaClient | typeof prisma = prisma,
  timeZone: string = DEFAULT_CBTF_TIMEZONE
): Promise<FacilityOperatingHoursResult> {
  const localDateStr = extractCalendarDate(targetDate, timeZone)
  const startOfDay = combineDateAndTime(localDateStr, '00:00', timeZone)
  const endOfDay = combineDateAndTime(localDateStr, '23:59', timeZone)

  // 1. Check schedule exception
  const exception = await (tx as any).cbtfScheduleException.findFirst({
    where: {
      facilityId,
      date: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  })

  if (exception) {
    if (exception.isClosed) {
      return {
        isOpen: false,
        openTime: null,
        closeTime: null,
        reason: exception.reason || 'Testing center closed for scheduled exception'
      }
    }
    if (exception.openTime && exception.closeTime) {
      return {
        isOpen: true,
        openTime: exception.openTime,
        closeTime: exception.closeTime,
        reason: exception.reason || null
      }
    }
  }

  // 2. Query weekly recurring operating hours (dayOfWeek in facility's timezone)
  const dayOfWeek = getLocalDayOfWeek(targetDate, timeZone)
  const weeklyHours = await (tx as any).cbtfOperatingHours.findUnique({
    where: {
      facilityId_dayOfWeek: {
        facilityId,
        dayOfWeek
      }
    }
  })

  if (weeklyHours) {
    return {
      isOpen: true,
      openTime: weeklyHours.openTime,
      closeTime: weeklyHours.closeTime,
      reason: null
    }
  }

  return {
    isOpen: false,
    openTime: null,
    closeTime: null,
    reason: 'Testing center closed on this day of week'
  }
}

/**
 * Calculates arrival throttling capacity: ceil(totalSeats / 12).
 */
export function calculateMaxArrivalsPerSlot(totalSeats: number): number {
  return Math.ceil(totalSeats / 12)
}

/**
 * Generates available 5-minute boundary slots for a given date,
 * filtering out throttled slots and capacity-exceeded slots.
 * Open and close times are interpreted in the facility's local timezone.
 */
export function generateAvailableSlotsForDate(
  facility: { totalSeats: number; timezone?: string },
  targetDate: Date,
  hours: FacilityOperatingHoursResult,
  existingReservations: { startTime: Date; endTime: Date; seatNumber: number }[],
  timeZone: string = facility.timezone || DEFAULT_CBTF_TIMEZONE
): SlotAvailability[] {
  if (!hours.isOpen || !hours.openTime || !hours.closeTime) {
    return []
  }

  const openDateTime = combineDateAndTime(targetDate, hours.openTime, timeZone)
  const closeDateTime = combineDateAndTime(targetDate, hours.closeTime, timeZone)

  const maxArrivals = calculateMaxArrivalsPerSlot(facility.totalSeats)
  const availableSlots: SlotAvailability[] = []

  const stepMs = 5 * 60 * 1000 // 5 minutes
  const durationMs = 60 * 60 * 1000 // 1 hour (60 minutes)

  // Facility must remain open for at least 1 hour after slot start time
  const latestStartMs = closeDateTime.getTime() - durationMs

  let currentMs = openDateTime.getTime()

  while (currentMs <= latestStartMs) {
    const slotStart = new Date(currentMs)
    const slotEnd = new Date(currentMs + durationMs)

    // 1. Arrival throttle: count reservations starting at exact slotStart
    const arrivalsCount = existingReservations.filter(
      (r) => r.startTime.getTime() === slotStart.getTime()
    ).length

    // 2. Active seat occupancy: count reservations overlapping [slotStart, slotEnd)
    const activeReservations = existingReservations.filter(
      (r) => r.startTime.getTime() < slotEnd.getTime() && r.endTime.getTime() > slotStart.getTime()
    )

    const isThrottleOk = arrivalsCount < maxArrivals
    const isCapacityOk = activeReservations.length < facility.totalSeats

    if (isThrottleOk && isCapacityOk) {
      availableSlots.push({
        startTime: slotStart,
        endTime: slotEnd,
        arrivalsCount,
        maxArrivals,
        occupiedSeatsCount: activeReservations.length,
        totalSeats: facility.totalSeats
      })
    }

    currentMs += stepMs
  }

  return availableSlots
}

/**
 * Calculates the slice of seat indices in seatAllocationOrder for a 5-minute arrival offset (0..11).
 * Partitions totalSeats into 12 contiguous blocks, distributing remainder seats to the earliest offsets.
 */
export function getOffsetSeatIndices(
  totalSeats: number,
  offset: number
): { startIndex: number; count: number } {
  if (totalSeats <= 0) {
    return { startIndex: 0, count: 0 }
  }
  const baseCount = Math.floor(totalSeats / 12)
  const remainder = totalSeats % 12
  const normalizedOffset = Math.max(0, Math.min(11, offset))

  const startIndex = normalizedOffset * baseCount + Math.min(normalizedOffset, remainder)
  const count = baseCount + (normalizedOffset < remainder ? 1 : 0)

  return { startIndex, count }
}

/**
 * Assigns the next available seat number based on the student's 5-minute arrival time offset.
 * Maps the 5-minute offset (:00, :05, ..., :55) to contiguous slices of seatAllocationOrder.
 * If all primary seats for the offset are occupied, gracefully overflows in circular order.
 */
export function assignNextSeat(
  seatAllocationOrder: number[],
  slotStart: Date,
  slotEnd: Date,
  activeReservationsInWindow: { seatNumber: number }[],
  _lastAssignedSeat?: number | null
): number {
  if (!seatAllocationOrder || seatAllocationOrder.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Facility seat allocation order is not configured'
    })
  }

  const occupiedSeats = new Set(activeReservationsInWindow.map((r) => r.seatNumber))
  const totalSeats = seatAllocationOrder.length

  // Calculate 5-minute arrival offset (0 for :00, 1 for :05, ..., 11 for :55)
  const minute = slotStart.getUTCMinutes()
  const offset = Math.floor(minute / 5)

  const { startIndex, count } = getOffsetSeatIndices(totalSeats, offset)

  // 1. First priority: Check primary candidate seats assigned to this 5-minute offset
  for (let i = 0; i < count; i++) {
    const candidateSeat = seatAllocationOrder[startIndex + i]
    if (!occupiedSeats.has(candidateSeat)) {
      return candidateSeat
    }
  }

  // 2. Fallback: If all primary seats for this offset are occupied, check remaining seats in circular order
  for (let i = 0; i < totalSeats; i++) {
    const candidateSeat = seatAllocationOrder[(startIndex + count + i) % totalSeats]
    if (!occupiedSeats.has(candidateSeat)) {
      return candidateSeat
    }
  }

  throw createError({
    statusCode: 409,
    statusMessage: 'No unallocated seats available at this time slot'
  })
}

/**
 * Resolves the effective student scheduling window for an assignment,
 * incorporating retake pass redemption windows if a pass was redeemed.
 */
export async function getStudentSchedulingWindow(
  userId: string,
  assignment: {
    id: string
    courseId?: string | null
    scheduleWindowStart: Date | null
    scheduleWindowEnd: Date | null
    availableFrom: Date | null
    dueDate: Date | null
    acceptUntil: Date | null
  },
  tx: PrismaClient | typeof prisma = prisma
): Promise<StudentSchedulingWindow> {
  // Check if student redeemed a pass for this assignment
  const latestRedemption = await (tx as any).passRedemption.findFirst({
    where: {
      pool: { userId },
      assignmentId: assignment.id
    },
    orderBy: { createdAt: 'desc' }
  })

  if (latestRedemption) {
    const start = latestRedemption.availableFrom || latestRedemption.createdAt
    const end = latestRedemption.acceptUntil || latestRedemption.dueDate

    if (start && end && end > start) {
      return {
        start,
        end,
        isPassWindow: true,
        redemptionId: latestRedemption.id
      }
    }
  }

  // Fallback to assignment's configured scheduling window or effective section dates
  let effectiveAvailableFrom = assignment.availableFrom
  let effectiveDueDate = assignment.dueDate
  let effectiveAcceptUntil = assignment.acceptUntil

  if (assignment.courseId) {
    try {
      const effective = await resolveStudentEffectiveDates(
        assignment,
        userId,
        assignment.courseId,
        tx
      )
      effectiveAvailableFrom = effective.availableFrom
      effectiveDueDate = effective.dueDate
      effectiveAcceptUntil = effective.acceptUntil
    } catch {
      // Fallback cleanly to assignment base dates if resolution errors
    }
  }

  const start = assignment.scheduleWindowStart || effectiveAvailableFrom || new Date()
  const end =
    assignment.scheduleWindowEnd ||
    effectiveAcceptUntil ||
    effectiveDueDate ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return {
    start,
    end,
    isPassWindow: false,
    redemptionId: null
  }
}

export const CBTF_AFTERNOON_DIVIDING_TIME = '12:30'
export const CBTF_AFTERNOON_DIVIDING_HOUR = 12.5 // 12:30 PM

function formatTimeStr12h(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

/**
 * Half-Day Block Scheduling Algorithm:
 * - Divides days at 12:30 PM (12:30) into Morning and Afternoon blocks.
 * - Offers the next 4 half-day blocks when slots are open.
 * - If a half-day block is currently in progress, includes it plus the next 4.
 * - If all evaluated blocks have utilization > 75%, offers the next 5 blocks instead of 4.
 * - Highlights blocks with utilization > 60%.
 */
export async function getRecommendedDaysAndSlots(
  facility: CbtfFacility & { operatingHours: any[]; scheduleExceptions: any[]; timezone?: string },
  studentWindow: StudentSchedulingWindow,
  preferenceOrBlockId?: string,
  selectedDateStr?: string,
  tx: PrismaClient | typeof prisma = prisma
): Promise<{
  blocks: CbtfHalfDayBlock[]
  recommendedDays: CbtfRecommendedDay[]
  hourlySlots: CbtfHourlySlotChoice[]
}> {
  const timeZone = facility.timezone || DEFAULT_CBTF_TIMEZONE
  const now = new Date()
  const searchStart = new Date(Math.max(studentWindow.start.getTime(), now.getTime()))
  const searchEnd = new Date(studentWindow.end)

  // Fetch all active reservations in the window once to avoid N+1 queries
  const allReservations: CbtfReservation[] = await (tx as any).cbtfReservation.findMany({
    where: {
      facilityId: facility.id,
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startTime: { gte: searchStart, lte: searchEnd }
    },
    select: {
      startTime: true,
      endTime: true,
      seatNumber: true
    }
  })

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]

  const candidateBlockItems: {
    block: CbtfHalfDayBlock
    openSlots: SlotAvailability[]
  }[] = []

  // Iterate calendar days within the student window (max 30 days lookahead) in facility timezone
  const localStartDateStr = getLocalDateString(searchStart, timeZone)
  const localEndDateStr = getLocalDateString(searchEnd, timeZone)
  const startParts = localStartDateStr.split('-').map(Number)
  const cursorDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]))
  const maxDays = 30
  let daysScanned = 0

  while (daysScanned < maxDays) {
    daysScanned++
    const dateStr = cursorDate.toISOString().split('T')[0]
    if (dateStr > localEndDateStr) {
      break
    }

    const dayStartUtc = combineDateAndTime(dateStr, '00:00', timeZone)
    const dayEndUtc = combineDateAndTime(dateStr, '23:59', timeZone)

    const hours = await getFacilityOperatingHoursForDate(facility.id, dayStartUtc, tx, timeZone)

    if (hours.isOpen && hours.openTime && hours.closeTime) {
      const dayReservations = allReservations.filter(
        (r) => r.startTime >= dayStartUtc && r.startTime <= dayEndUtc
      )

      const theoreticalSlots = generateAvailableSlotsForDate(
        facility,
        dayStartUtc,
        hours,
        [],
        timeZone
      )
      const allSlots = generateAvailableSlotsForDate(
        facility,
        dayStartUtc,
        hours,
        dayReservations,
        timeZone
      )

      const dayOfWeek = getLocalDayOfWeek(dayStartUtc, timeZone)
      const dayName = dayNames[dayOfWeek]
      const localMonth = cursorDate.getUTCMonth()
      const localDayNum = cursorDate.getUTCDate()
      const monthName = monthNames[localMonth]
      const dateLabel = `${monthName} ${localDayNum}`

      const afternoonDividingUtc = combineDateAndTime(
        dateStr,
        CBTF_AFTERNOON_DIVIDING_TIME,
        timeZone
      )

      // Morning block: openTime until 12:30
      if (hours.openTime < CBTF_AFTERNOON_DIVIDING_TIME) {
        const blockStart = combineDateAndTime(dateStr, hours.openTime, timeZone)
        const blockEnd = afternoonDividingUtc
        const theoreticalBlockSlots = theoreticalSlots.filter(
          (s) =>
            s.startTime < afternoonDividingUtc &&
            s.startTime >= studentWindow.start &&
            s.endTime <= studentWindow.end
        )
        const openSlots = allSlots.filter(
          (s) =>
            s.startTime < afternoonDividingUtc &&
            s.startTime.getTime() >= now.getTime() + 15 * 60 * 1000 &&
            s.startTime >= studentWindow.start &&
            s.endTime <= studentWindow.end
        )

        if (openSlots.length > 0) {
          const isCurrentBlock = now >= blockStart && now < blockEnd
          const totalSlotsCount = theoreticalBlockSlots.length
          const openSlotsCount = openSlots.length
          const utilizationPercentage =
            totalSlotsCount > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((totalSlotsCount - openSlotsCount) / totalSlotsCount) * 100)
                  )
                )
              : 100

          candidateBlockItems.push({
            block: {
              id: `${dateStr}-morning`,
              date: dateStr,
              dayOfWeek,
              blockType: 'morning',
              label: `${dayName} Morning`,
              dateLabel,
              timeRangeLabel: `${formatTimeStr12h(hours.openTime)} – ${formatTimeStr12h(CBTF_AFTERNOON_DIVIDING_TIME)}`,
              isCurrentBlock,
              openSlotsCount,
              totalSlotsCount,
              utilizationPercentage,
              isHighDemand: utilizationPercentage > 60
            },
            openSlots
          })
        }
      }

      // Afternoon block: 12:30 until closeTime
      if (hours.closeTime > CBTF_AFTERNOON_DIVIDING_TIME) {
        const blockStart = afternoonDividingUtc
        const blockEnd = combineDateAndTime(dateStr, hours.closeTime, timeZone)
        const theoreticalBlockSlots = theoreticalSlots.filter(
          (s) =>
            s.startTime >= afternoonDividingUtc &&
            s.startTime >= studentWindow.start &&
            s.endTime <= studentWindow.end
        )
        const openSlots = allSlots.filter(
          (s) =>
            s.startTime >= afternoonDividingUtc &&
            s.startTime.getTime() >= now.getTime() + 15 * 60 * 1000 &&
            s.startTime >= studentWindow.start &&
            s.endTime <= studentWindow.end
        )

        if (openSlots.length > 0) {
          const isCurrentBlock = now >= blockStart && now < blockEnd
          const totalSlotsCount = theoreticalBlockSlots.length
          const openSlotsCount = openSlots.length
          const utilizationPercentage =
            totalSlotsCount > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((totalSlotsCount - openSlotsCount) / totalSlotsCount) * 100)
                  )
                )
              : 100

          candidateBlockItems.push({
            block: {
              id: `${dateStr}-afternoon`,
              date: dateStr,
              dayOfWeek,
              blockType: 'afternoon',
              label: `${dayName} Afternoon`,
              dateLabel,
              timeRangeLabel: `${formatTimeStr12h(CBTF_AFTERNOON_DIVIDING_TIME)} – ${formatTimeStr12h(hours.closeTime)}`,
              isCurrentBlock,
              openSlotsCount,
              totalSlotsCount,
              utilizationPercentage,
              isHighDemand: utilizationPercentage > 60
            },
            openSlots
          })
        }
      }
    }

    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1)
  }

  // Identify current in-progress block vs future blocks
  const currentBlockItem = candidateBlockItems.find((i) => i.block.isCurrentBlock)
  const futureBlockItems = candidateBlockItems.filter((i) => !i.block.isCurrentBlock)

  // Evaluate initial lookahead blocks: current (if active) + next 4
  const initialLookaheadBlocks = currentBlockItem
    ? [currentBlockItem.block, ...futureBlockItems.slice(0, 4).map((i) => i.block)]
    : futureBlockItems.slice(0, 4).map((i) => i.block)

  // If all evaluated blocks have utilization > 75%, show next 5 blocks instead of 4
  const allAbove75 =
    initialLookaheadBlocks.length > 0 &&
    initialLookaheadBlocks.every((b) => b.utilizationPercentage > 75)

  const futureCount = allAbove75 ? 5 : 4
  const selectedBlockItems = currentBlockItem
    ? [currentBlockItem, ...futureBlockItems.slice(0, futureCount)]
    : futureBlockItems.slice(0, futureCount)

  const blocks: CbtfHalfDayBlock[] = selectedBlockItems.map((i) => i.block)

  // Backwards compatibility: recommendedDays derived from candidate days
  const uniqueDates = Array.from(new Set(blocks.map((b) => b.date)))
  const recommendedDays: CbtfRecommendedDay[] = uniqueDates.map((dateStr) => {
    const dayBlocks = blocks.filter((b) => b.date === dateStr)
    const firstBlock = dayBlocks[0]
    const totalOpenSlots = dayBlocks.reduce((acc, b) => acc + b.openSlotsCount, 0)
    const avgUtilization = Math.round(
      dayBlocks.reduce((acc, b) => acc + b.utilizationPercentage, 0) / dayBlocks.length
    )
    return {
      date: dateStr,
      dayOfWeek: firstBlock.dayOfWeek,
      label: `${firstBlock.label.split(' ')[0]}, ${firstBlock.dateLabel}`,
      openSlotsCount: totalOpenSlots,
      utilizationPercentage: avgUtilization
    }
  })

  // Determine which block to pick hourly slots for
  let chosenBlockItem = selectedBlockItems[0]

  if (preferenceOrBlockId) {
    const matchById = selectedBlockItems.find((i) => i.block.id === preferenceOrBlockId)
    if (matchById) {
      chosenBlockItem = matchById
    } else if (selectedDateStr) {
      const matchByDatePref = selectedBlockItems.find(
        (i) =>
          i.block.date === selectedDateStr &&
          (!preferenceOrBlockId || i.block.blockType === preferenceOrBlockId)
      )
      if (matchByDatePref) {
        chosenBlockItem = matchByDatePref
      }
    } else if (preferenceOrBlockId === 'morning' || preferenceOrBlockId === 'afternoon') {
      const matchByPref = selectedBlockItems.find((i) => i.block.blockType === preferenceOrBlockId)
      if (matchByPref) {
        chosenBlockItem = matchByPref
      }
    }
  } else if (selectedDateStr) {
    const matchByDate = selectedBlockItems.find((i) => i.block.date === selectedDateStr)
    if (matchByDate) {
      chosenBlockItem = matchByDate
    }
  }

  let hourlySlots: CbtfHourlySlotChoice[] = []
  if (chosenBlockItem) {
    // Group slots by half-hour period (e.g. 09:00, 09:30, 10:00, ...) in facility timezone
    const slotsByHalfHour = new Map<number, SlotAvailability[]>()
    for (const slot of chosenBlockItem.openSlots) {
      const parts = getLocalTimeParts(slot.startTime, timeZone)
      const halfHourBucket = parts.minute < 30 ? 0 : 30
      const periodKey = parts.hour24 * 60 + halfHourBucket

      if (!slotsByHalfHour.has(periodKey)) {
        slotsByHalfHour.set(periodKey, [])
      }
      slotsByHalfHour.get(periodKey)!.push(slot)
    }

    const sortedPeriodKeys = Array.from(slotsByHalfHour.keys()).sort((a, b) => a - b)
    hourlySlots = sortedPeriodKeys.map((periodKey) => {
      const candidates = slotsByHalfHour.get(periodKey)!

      // Maximum available openings priority:
      // Find the minimum arrivalsCount across all candidate slots in this half-hour
      const minArrivals = Math.min(...candidates.map((s) => s.arrivalsCount))
      const minArrivalCandidates = candidates.filter((s) => s.arrivalsCount === minArrivals)

      // Secondary tie-breaker: minimum occupied seats across facility
      const minOccupiedSeats = Math.min(...minArrivalCandidates.map((s) => s.occupiedSeatsCount))
      const bestCandidates = minArrivalCandidates.filter(
        (s) => s.occupiedSeatsCount === minOccupiedSeats
      )

      // Randomly choose among the candidate slots with the same maximum openings
      const randomIndex = Math.floor(Math.random() * bestCandidates.length)
      const chosenSlot = bestCandidates[randomIndex]

      const start = chosenSlot.startTime
      const end = chosenSlot.endTime

      const parts = getLocalTimeParts(start, timeZone)

      return {
        hour: parts.hour24,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        formattedTime: parts.formattedTime
      }
    })
  }

  return {
    blocks,
    recommendedDays,
    hourlySlots
  }
}

/**
 * Projects a raw Prisma CbtfReservation to a CbtfReservationDto
 */
export function toCbtfReservationDto(res: any): CbtfReservationDto {
  return {
    id: res.id,
    facilityId: res.facilityId,
    assignmentId: res.assignmentId,
    assignmentTitle: res.assignment?.title,
    userId: res.userId,
    studentName: res.user ? `${res.user.firstName} ${res.user.lastName}` : undefined,
    studentEmail: res.user?.email ?? null,
    studentId: res.user?.studentId ?? null,
    studentAvatarUrl: res.user?.avatarUrl ?? null,
    seatNumber: res.seatNumber,
    startTime: res.startTime instanceof Date ? res.startTime.toISOString() : res.startTime,
    endTime: res.endTime instanceof Date ? res.endTime.toISOString() : res.endTime,
    status: res.status,
    checkedInAt: res.checkedInAt
      ? res.checkedInAt instanceof Date
        ? res.checkedInAt.toISOString()
        : res.checkedInAt
      : null,
    checkedOutAt: res.checkedOutAt
      ? res.checkedOutAt instanceof Date
        ? res.checkedOutAt.toISOString()
        : res.checkedOutAt
      : null,
    checkedInByUserId: res.checkedInByUserId ?? null,
    checkedOutByUserId: res.checkedOutByUserId ?? null,
    canvasOverrideId: res.canvasOverrideId ?? null,
    noteCount: res.notes ? res.notes.length : undefined,
    notes: res.notes
      ? res.notes.map((n: any) => ({
          id: n.id,
          reservationId: n.reservationId,
          authorId: n.authorId,
          authorName: n.author ? `${n.author.firstName} ${n.author.lastName}`.trim() : undefined,
          content: n.content,
          hasPhotos: Boolean(n.hasPhotos),
          createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
          updatedAt: n.updatedAt instanceof Date ? n.updatedAt.toISOString() : n.updatedAt
        }))
      : undefined
  }
}

/**
 * Returns live feed of seated roster, arriving students, departures, and facility capacity
 */
export async function getProctorLiveFeed(prisma: PrismaClient, facilityId?: string) {
  const facility = facilityId
    ? await prisma.cbtfFacility.findUnique({ where: { id: facilityId } })
    : await getPrimaryCbtfFacility(prisma)

  if (!facility) {
    throw createError({ statusCode: 404, statusMessage: 'No facility found' })
  }

  const now = new Date()
  const graceMinutes = facility.checkInGraceMinutes ?? 15

  const reservations = await prisma.cbtfReservation.findMany({
    where: {
      facilityId: facility.id,
      OR: [
        { status: 'CHECKED_IN' },
        {
          status: 'SCHEDULED',
          startTime: {
            gte: new Date(now.getTime() - graceMinutes * 60000),
            lte: new Date(now.getTime() + 90 * 60000)
          }
        },
        {
          status: 'CHECKED_OUT',
          checkedOutAt: {
            gte: new Date(now.getTime() - 30 * 60000)
          }
        }
      ]
    },
    include: {
      assignment: { select: { title: true } },
      notes: {
        include: {
          author: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { seatNumber: 'asc' }
  })

  // Seated: currently checked in
  const seated = reservations
    .filter((r) => r.status === 'CHECKED_IN')
    .map((r) => {
      const dto = toCbtfReservationDto(r)
      const startMs = new Date(r.startTime).getTime()
      const endMs = new Date(r.endTime).getTime()
      const nowMs = now.getTime()
      const elapsedMinutes = Math.max(0, Math.floor((nowMs - startMs) / 60000))
      const remainingMinutes = Math.max(0, Math.floor((endMs - nowMs) / 60000))
      return {
        ...dto,
        elapsedMinutes,
        remainingMinutes
      }
    })

  // Arriving: SCHEDULED, within upcoming slot window
  const arriving = reservations
    .filter((r) => r.status === 'SCHEDULED')
    .map(toCbtfReservationDto)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Departures: Seated students with <= 10 min remaining or recently checked out
  const departures = reservations
    .filter((r) => {
      if (r.status === 'CHECKED_OUT') return true
      if (r.status === 'CHECKED_IN') {
        const remainingMs = new Date(r.endTime).getTime() - now.getTime()
        return remainingMs <= 10 * 60000
      }
      return false
    })
    .map(toCbtfReservationDto)
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())

  const totalSeats = facility.totalSeats ?? 48
  const occupiedSeats = seated.length
  const availableSeats = Math.max(0, totalSeats - occupiedSeats)

  return {
    facility: {
      id: facility.id,
      name: facility.name,
      totalSeats,
      occupiedSeats,
      availableSeats,
      checkInLeadMinutes: facility.checkInLeadMinutes ?? 5,
      checkInGraceMinutes: facility.checkInGraceMinutes ?? 15
    },
    counts: {
      seated: seated.length,
      arriving: arriving.length,
      departures: departures.length
    },
    seated,
    arriving,
    departures
  }
}

/**
 * Looks up student by studentId and determines check-in / check-out decision
 */
export async function lookupStudentForProctor(prisma: PrismaClient, studentId: string) {
  const cleanId = studentId.trim()
  if (!cleanId) {
    throw createError({ statusCode: 400, statusMessage: 'Student ID is required' })
  }

  const user = await prisma.user.findFirst({
    where: {
      studentId: cleanId
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      email: true,
      avatarUrl: true
    }
  })

  if (!user) {
    return {
      found: false,
      student: null,
      reservation: null,
      decision: 'STUDENT_NOT_FOUND',
      message: `No student found matching ID: ${cleanId}`
    }
  }

  const facility = await getPrimaryCbtfFacility(prisma)
  const leadMinutes = facility.checkInLeadMinutes ?? 5
  const graceMinutes = facility.checkInGraceMinutes ?? 15
  const now = new Date()

  // 1. Check if student is currently seated (ready for checkout)
  const seatedReservation = await prisma.cbtfReservation.findFirst({
    where: {
      userId: user.id,
      facilityId: facility.id,
      status: 'CHECKED_IN'
    },
    include: {
      assignment: { select: { title: true } },
      notes: {
        include: {
          author: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { startTime: 'desc' }
  })

  if (seatedReservation) {
    const dto = toCbtfReservationDto({ ...seatedReservation, user })
    return {
      found: true,
      student: user,
      reservation: dto,
      decision: 'READY_FOR_CHECKOUT',
      message: 'Student is currently seated and ready for checkout.'
    }
  }

  // 2. Check for scheduled reservation closest to now
  const scheduledReservation = await prisma.cbtfReservation.findFirst({
    where: {
      userId: user.id,
      facilityId: facility.id,
      status: 'SCHEDULED'
    },
    include: {
      assignment: { select: { title: true } },
      notes: {
        include: {
          author: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { startTime: 'asc' }
  })

  if (scheduledReservation) {
    const dto = toCbtfReservationDto({ ...scheduledReservation, user })
    const startMs = new Date(scheduledReservation.startTime).getTime()
    const nowMs = now.getTime()
    const earliestAllowedMs = startMs - leadMinutes * 60000
    const latestAllowedMs = startMs + graceMinutes * 60000

    if (nowMs < earliestAllowedMs) {
      const minutesEarly = Math.ceil((earliestAllowedMs - nowMs) / 60000)
      return {
        found: true,
        student: user,
        reservation: dto,
        decision: 'EARLY',
        leadMinutes,
        graceMinutes,
        message: `Too early to check in. Check-in opens in ${minutesEarly} minute(s) before start time to prevent workstation collision.`
      }
    }

    if (nowMs > latestAllowedMs) {
      const minutesLate = Math.floor((nowMs - startMs) / 60000)
      return {
        found: true,
        student: user,
        reservation: dto,
        decision: 'LATE',
        leadMinutes,
        graceMinutes,
        message: `Reservation is ${minutesLate} minutes late (grace period: ${graceMinutes} mins). Proctor override required to check in.`
      }
    }

    return {
      found: true,
      student: user,
      reservation: dto,
      decision: 'READY_FOR_CHECKIN',
      leadMinutes,
      graceMinutes,
      message: `Verified for ${scheduledReservation.assignment?.title || 'Exam'}. Direct to Workstation Seat #${scheduledReservation.seatNumber}.`
    }
  }

  // 3. Fallback: check recent past reservation
  const pastReservation = await prisma.cbtfReservation.findFirst({
    where: {
      userId: user.id,
      facilityId: facility.id
    },
    include: {
      assignment: { select: { title: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return {
    found: true,
    student: user,
    reservation: pastReservation ? toCbtfReservationDto({ ...pastReservation, user }) : null,
    decision: 'NO_ACTIVE_RESERVATION',
    message: pastReservation
      ? `No active reservation scheduled for now. Last reservation status: ${pastReservation.status}.`
      : 'No scheduled exam reservations found for this student.'
  }
}

/**
 * Checks in a scheduled reservation
 */
export async function checkInReservation(
  prisma: PrismaClient,
  reservationId: string,
  proctorUserId: string
) {
  const reservation = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
      assignment: { select: { title: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  if (!reservation) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  if (reservation.status === 'CHECKED_IN') {
    throw createError({ statusCode: 400, statusMessage: 'Student is already checked in' })
  }

  if (reservation.status !== 'SCHEDULED') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot check in reservation with status '${reservation.status}'`
    })
  }

  const updated = await prisma.cbtfReservation.update({
    where: { id: reservationId },
    data: {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
      checkedInByUserId: proctorUserId
    },
    include: {
      assignment: { select: { title: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  return toCbtfReservationDto(updated)
}

/**
 * Checks out a seated reservation
 */
export async function checkOutReservation(
  prisma: PrismaClient,
  reservationId: string,
  proctorUserId: string
) {
  const reservation = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
      assignment: { select: { title: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  if (!reservation) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  if (reservation.status !== 'CHECKED_IN') {
    throw createError({
      statusCode: 400,
      statusMessage: `Reservation is not currently checked in (status: '${reservation.status}')`
    })
  }

  const updated = await prisma.cbtfReservation.update({
    where: { id: reservationId },
    data: {
      status: 'CHECKED_OUT',
      checkedOutAt: new Date(),
      checkedOutByUserId: proctorUserId
    },
    include: {
      assignment: { select: { title: true } },
      notes: {
        include: {
          author: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  // Trigger incident email notification if any notes exist for this test session
  const noteCount =
    (await (prisma as any).cbtfReservationNote?.count?.({
      where: { reservationId }
    })) ?? 0
  if (noteCount > 0) {
    sendCbtfIncidentNotification(reservationId).catch((err: any) => {
      console.error('[CBTF Notification] Checkout notification dispatch error:', err)
    })
  }

  return toCbtfReservationDto(updated)
}

/**
 * Adds a proctor observation note / incident report to a reservation.
 */
export async function addReservationNote(
  prisma: PrismaClient,
  data: {
    reservationId?: string
    seatNumber?: number
    authorId: string
    content: string
    hasPhotos?: boolean
  }
) {
  let targetReservationId = data.reservationId

  if (!targetReservationId && data.seatNumber) {
    const facility = await getPrimaryCbtfFacility(prisma)
    // Locate the active (seated or scheduled) reservation at this seat
    const activeAtSeat = await prisma.cbtfReservation.findFirst({
      where: {
        facilityId: facility.id,
        seatNumber: data.seatNumber,
        status: { in: ['CHECKED_IN', 'SCHEDULED'] }
      },
      orderBy: { startTime: 'asc' }
    })

    if (!activeAtSeat) {
      throw createError({
        statusCode: 404,
        statusMessage: `No active reservation found at Workstation Seat #${data.seatNumber}`
      })
    }
    targetReservationId = activeAtSeat.id
  }

  if (!targetReservationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Either reservationId or seatNumber is required'
    })
  }

  const note = await prisma.cbtfReservationNote.create({
    data: {
      reservationId: targetReservationId,
      authorId: data.authorId,
      content: data.content.trim(),
      hasPhotos: Boolean(data.hasPhotos)
    },
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      reservation: {
        select: {
          id: true,
          seatNumber: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              studentId: true
            }
          }
        }
      }
    }
  })

  return {
    id: note.id,
    reservationId: note.reservationId,
    seatNumber: note.reservation.seatNumber,
    studentName: `${note.reservation.user.firstName} ${note.reservation.user.lastName}`.trim(),
    authorId: note.authorId,
    authorName: `${note.author.firstName} ${note.author.lastName}`.trim(),
    content: note.content,
    hasPhotos: note.hasPhotos,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  }
}

/**
 * Automatically transitions past-due reservations in SCHEDULED status whose
 * scheduled end time has elapsed into MISSED status.
 * Can be filtered by userId, facilityId, and/or assignmentId.
 */
export async function autoExpirePastScheduledReservations(
  filter?: { userId?: string; facilityId?: string; assignmentId?: string },
  tx: PrismaClient | typeof prisma = prisma
): Promise<number> {
  const now = new Date()
  const where: Record<string, any> = {
    status: 'SCHEDULED',
    endTime: { lt: now }
  }

  if (filter?.userId) where.userId = filter.userId
  if (filter?.facilityId) where.facilityId = filter.facilityId
  if (filter?.assignmentId) where.assignmentId = filter.assignmentId

  const result = await (tx as any).cbtfReservation.updateMany({
    where,
    data: {
      status: 'MISSED'
    }
  })

  return result.count
}
