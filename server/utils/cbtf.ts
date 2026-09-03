/**
 * CBTF (Computer-Based Testing Facility) Core Engine
 *
 * Algorithms for operating hours, 5-minute slot generation, arrival throttling,
 * sequential seat allocation, retake pass windows, and progressive narrowing.
 */

import { createError } from 'h3'
import type { PrismaClient } from '@prisma/client'
import prisma from '@@/server/utils/db'
import type {
  CbtfFacility,
  CbtfReservation,
  CbtfRecommendedDay,
  CbtfHourlySlotChoice,
  CbtfReservationDto
} from '@@/shared/models/cbtf'

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

/**
 * Resolves facility operating hours for a specific calendar date, checking exceptions first.
 */
export async function getFacilityOperatingHoursForDate(
  facilityId: string,
  targetDate: Date,
  tx: PrismaClient | typeof prisma = prisma
): Promise<FacilityOperatingHoursResult> {
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setUTCHours(23, 59, 59, 999)

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

  // 2. Query weekly recurring operating hours (targetDate.getUTCDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat)
  const dayOfWeek = targetDate.getUTCDay()
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
 * Helper to build Date object from date and "HH:mm" time string (in UTC).
 */
export function combineDateAndTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const result = new Date(date)
  result.setUTCHours(hours, minutes, 0, 0)
  return result
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
 */
export function generateAvailableSlotsForDate(
  facility: { totalSeats: number },
  targetDate: Date,
  hours: FacilityOperatingHoursResult,
  existingReservations: { startTime: Date; endTime: Date; seatNumber: number }[]
): SlotAvailability[] {
  if (!hours.isOpen || !hours.openTime || !hours.closeTime) {
    return []
  }

  const openDateTime = combineDateAndTime(targetDate, hours.openTime)
  const closeDateTime = combineDateAndTime(targetDate, hours.closeTime)

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
 * Assigns the next available seat number following the facility's definable sequence order.
 * Ensures consecutive bookings in the same or consecutive slots follow this sequence,
 * continuing through the order and skipping occupied seats.
 */
export function assignNextSeat(
  seatAllocationOrder: number[],
  slotStart: Date,
  slotEnd: Date,
  activeReservationsInWindow: { seatNumber: number }[],
  lastAssignedSeat?: number | null
): number {
  if (!seatAllocationOrder || seatAllocationOrder.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Facility seat allocation order is not configured'
    })
  }

  const occupiedSeats = new Set(activeReservationsInWindow.map((r) => r.seatNumber))

  // Find start index in seatAllocationOrder
  let startIndex = 0
  if (lastAssignedSeat !== undefined && lastAssignedSeat !== null) {
    const lastIdx = seatAllocationOrder.indexOf(lastAssignedSeat)
    if (lastIdx !== -1) {
      startIndex = (lastIdx + 1) % seatAllocationOrder.length
    }
  }

  // Iterate in circular order through the sequence
  for (let i = 0; i < seatAllocationOrder.length; i++) {
    const candidateSeat = seatAllocationOrder[(startIndex + i) % seatAllocationOrder.length]
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

  // Fallback to assignment's configured scheduling window
  const start = assignment.scheduleWindowStart || assignment.availableFrom || new Date()
  const end =
    assignment.scheduleWindowEnd ||
    assignment.acceptUntil ||
    assignment.dueDate ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return {
    start,
    end,
    isPassWindow: false,
    redemptionId: null
  }
}

/**
 * Progressive Narrowing Algorithm:
 * Step 1: Filters slots by morning (< 12:00) or afternoon (>= 12:00) preference.
 * Step 2: Recommends 3-4 days with highest open slot count / lowest utilization.
 * Step 3: For selectedDate, groups open slots by hour and randomly picks 1 slot per hour.
 */
export async function getRecommendedDaysAndSlots(
  facility: CbtfFacility & { operatingHours: any[]; scheduleExceptions: any[] },
  studentWindow: StudentSchedulingWindow,
  preference?: 'morning' | 'afternoon',
  selectedDateStr?: string,
  tx: PrismaClient | typeof prisma = prisma
): Promise<{
  recommendedDays: CbtfRecommendedDay[]
  hourlySlots: CbtfHourlySlotChoice[]
}> {
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

  const dayBuckets: {
    dateStr: string
    date: Date
    dayOfWeek: number
    slots: SlotAvailability[]
    filteredSlots: SlotAvailability[]
  }[] = []

  // Iterate calendar days within the student window (max 30 days lookahead)
  const currentDay = new Date(searchStart)
  currentDay.setUTCHours(0, 0, 0, 0)
  const maxDays = 30
  let daysScanned = 0

  while (currentDay <= searchEnd && daysScanned < maxDays) {
    daysScanned++
    const targetDate = new Date(currentDay)
    const dateStr = targetDate.toISOString().split('T')[0]

    const hours = await getFacilityOperatingHoursForDate(facility.id, targetDate, tx)

    if (hours.isOpen && hours.openTime && hours.closeTime) {
      // Find reservations for this day
      const dayStart = new Date(targetDate)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate)
      dayEnd.setUTCHours(23, 59, 59, 999)

      const dayReservations = allReservations.filter(
        (r) => r.startTime >= dayStart && r.startTime <= dayEnd
      )

      const allSlots = generateAvailableSlotsForDate(facility, targetDate, hours, dayReservations)

      // Filter slots by preference if requested
      const filteredSlots = allSlots.filter((slot) => {
        // Exclude slots in the past (must be at least 15 min from now)
        if (slot.startTime.getTime() < Date.now() + 15 * 60 * 1000) {
          return false
        }
        if (!preference) return true
        const hour = slot.startTime.getUTCHours()
        if (preference === 'morning') return hour < 12
        if (preference === 'afternoon') return hour >= 12
        return true
      })

      if (filteredSlots.length > 0) {
        dayBuckets.push({
          dateStr,
          date: targetDate,
          dayOfWeek: targetDate.getUTCDay(),
          slots: allSlots,
          filteredSlots
        })
      }
    }

    currentDay.setUTCDate(currentDay.getUTCDate() + 1)
  }

  // Sort days by open slot count (descending) and take top 3-4 days
  dayBuckets.sort((a, b) => b.filteredSlots.length - a.filteredSlots.length)
  const topDayBuckets = dayBuckets.slice(0, 4)

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

  const recommendedDays: CbtfRecommendedDay[] = topDayBuckets.map((bucket) => {
    const d = bucket.date
    const label = `${dayNames[d.getUTCDay()]}, ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`
    const totalSlots = bucket.slots.length || 1
    const openSlots = bucket.filteredSlots.length
    const utilization = Math.round(((totalSlots - openSlots) / totalSlots) * 100)

    return {
      date: bucket.dateStr,
      dayOfWeek: bucket.dayOfWeek,
      label,
      openSlotsCount: openSlots,
      utilizationPercentage: Math.max(0, Math.min(100, utilization))
    }
  })

  // Determine which day to pick slots for
  const chosenDateStr = selectedDateStr || recommendedDays[0]?.date
  let hourlySlots: CbtfHourlySlotChoice[] = []

  if (chosenDateStr) {
    const chosenBucket = dayBuckets.find((b) => b.dateStr === chosenDateStr)
    if (chosenBucket) {
      // Group available slots by hour (UTC hour)
      const slotsByHour = new Map<number, SlotAvailability[]>()
      for (const slot of chosenBucket.filteredSlots) {
        const hour = slot.startTime.getUTCHours()
        if (!slotsByHour.has(hour)) {
          slotsByHour.set(hour, [])
        }
        slotsByHour.get(hour)!.push(slot)
      }

      // Randomly select 1 open slot per available hour
      const sortedHours = Array.from(slotsByHour.keys()).sort((a, b) => a - b)
      hourlySlots = sortedHours.map((hour) => {
        const candidates = slotsByHour.get(hour)!
        const randomIndex = Math.floor(Math.random() * candidates.length)
        const chosenSlot = candidates[randomIndex]

        const start = chosenSlot.startTime
        const end = chosenSlot.endTime

        const h = start.getUTCHours()
        const m = start.getUTCMinutes().toString().padStart(2, '0')
        const ampm = h >= 12 ? 'PM' : 'AM'
        const displayH = h % 12 === 0 ? 12 : h % 12
        const formattedTime = `${displayH}:${m} ${ampm}`

        return {
          hour,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          formattedTime
        }
      })
    }
  }

  return {
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
    checkedOutByUserId: res.checkedOutByUserId ?? null
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

  const totalSeats = facility.totalSeats || 48
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
      assignment: { select: { title: true } }
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
      assignment: { select: { title: true } }
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
