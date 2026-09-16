import { formatTimeStr12h } from '@@/shared/utils/proctor-schedule-parser'

export const INTERVIEW_SLOT_INTERVAL_MINUTES = 10
export const INTERVIEW_DURATION_MINUTES = 5
export const GTA_AFTERNOON_DIVIDING_TIME = '12:30'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface GtaSlot {
  startTime: string // ISO string
  endTime: string // ISO string
  time24: string // "HH:mm"
  label: string // e.g. "10:00 AM – 10:05 AM"
  availableGtaCount: number
  totalGtaCount: number
}

export interface GtaHalfDayBlock {
  date: string // "YYYY-MM-DD"
  dayOfWeek: number
  dayName: string
  blockType: 'MORNING' | 'AFTERNOON'
  blockLabel: string
  timeRangeLabel: string
  slots: GtaSlot[]
}

export interface ShiftInput {
  id?: string
  userId: string
  date: Date | string
  startTime: string
  endTime: string
}

export interface ReservationInput {
  id?: string
  gtaId: string
  startTime: Date | string
  status: string
}

/**
 * Breaks GTA shifts into 10-minute interview intervals (5-minute interview + 5-minute buffer),
 * calculates overlapping GTA capacity, subtracts active reservations, filters by
 * assignment window and current time, and groups available slots into half-day blocks.
 */
export function calculateGtaSlotsForShifts(
  shifts: ShiftInput[],
  existingReservations: ReservationInput[] = [],
  windowStart?: Date | string | null,
  windowEnd?: Date | string | null,
  now: Date = new Date()
): GtaHalfDayBlock[] {
  // Map of slotStartIso -> Set of GTA userIds on duty
  const slotGtasMap = new Map<string, Set<string>>()
  const slotMetaMap = new Map<
    string,
    { dateStr: string; time24: string; endSlotIso: string; endTime24: string }
  >()

  for (const shift of shifts) {
    const dStr =
      typeof shift.date === 'string'
        ? shift.date.split('T')[0]
        : shift.date.toISOString().split('T')[0]

    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)

    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue

    const startTotal = sh * 60 + sm
    const endTotal = eh * 60 + em

    for (
      let m = startTotal;
      m + INTERVIEW_DURATION_MINUTES <= endTotal;
      m += INTERVIEW_SLOT_INTERVAL_MINUTES
    ) {
      const slotH = Math.floor(m / 60)
      const slotM = m % 60
      const time24 = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`
      const slotStartIso = `${dStr}T${time24}:00.000Z`

      const endM = m + INTERVIEW_DURATION_MINUTES
      const endH = Math.floor(endM / 60)
      const endMin = endM % 60
      const endTime24 = `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      const endSlotIso = `${dStr}T${endTime24}:00.000Z`

      if (!slotGtasMap.has(slotStartIso)) {
        slotGtasMap.set(slotStartIso, new Set())
        slotMetaMap.set(slotStartIso, { dateStr: dStr, time24, endSlotIso, endTime24 })
      }
      slotGtasMap.get(slotStartIso)!.add(shift.userId)
    }
  }

  // Pre-filter active reservations by slotStartIso
  const activeReservationsBySlot = new Map<string, number>()
  for (const res of existingReservations) {
    if (res.status === 'CANCELLED' || res.status === 'MISSED') continue
    const startIso =
      typeof res.startTime === 'string'
        ? res.startTime.includes('T')
          ? `${res.startTime.split('.')[0]}.000Z`
          : res.startTime
        : res.startTime.toISOString()

    // Normalize ISO to minute boundary
    const normalizedIso = startIso.substring(0, 16) + ':00.000Z'
    activeReservationsBySlot.set(
      normalizedIso,
      (activeReservationsBySlot.get(normalizedIso) || 0) + 1
    )
  }

  const winStart = windowStart ? new Date(windowStart) : null
  const winEnd = windowEnd ? new Date(windowEnd) : null

  // Map of blockKey (dateStr_MORNING or dateStr_AFTERNOON) -> GtaSlot[]
  const blocksMap = new Map<string, GtaSlot[]>()

  for (const [slotStartIso, gtaSet] of slotGtasMap.entries()) {
    const slotStartDate = new Date(slotStartIso)

    // Must be in the future
    if (slotStartDate <= now) continue

    // Must be within window
    if (winStart && slotStartDate < winStart) continue
    if (winEnd && slotStartDate > winEnd) continue

    const totalGtaCount = gtaSet.size
    const bookedCount = activeReservationsBySlot.get(slotStartIso) || 0
    const availableGtaCount = totalGtaCount - bookedCount

    // Skip if all on-duty GTAs are booked
    if (availableGtaCount <= 0) continue

    const meta = slotMetaMap.get(slotStartIso)!
    const isMorning = meta.time24 < GTA_AFTERNOON_DIVIDING_TIME
    const blockType = isMorning ? 'MORNING' : 'AFTERNOON'
    const blockKey = `${meta.dateStr}_${blockType}`

    if (!blocksMap.has(blockKey)) {
      blocksMap.set(blockKey, [])
    }

    blocksMap.get(blockKey)!.push({
      startTime: slotStartIso,
      endTime: meta.endSlotIso,
      time24: meta.time24,
      label: `${formatTimeStr12h(meta.time24)} – ${formatTimeStr12h(meta.endTime24)}`,
      availableGtaCount,
      totalGtaCount
    })
  }

  // Convert grouped blocks to array
  const blocks: GtaHalfDayBlock[] = []

  for (const [blockKey, slots] of blocksMap.entries()) {
    if (slots.length === 0) continue

    const [dateStr, blockType] = blockKey.split('_') as [string, 'MORNING' | 'AFTERNOON']
    const dateObj = new Date(`${dateStr}T00:00:00.000Z`)
    const dayOfWeek = dateObj.getUTCDay()
    const dayName = DAY_NAMES[dayOfWeek]

    // Sort slots chronologically
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime))

    const isMorning = blockType === 'MORNING'
    const blockLabel = `${dayName} ${isMorning ? 'Morning' : 'Afternoon'}`
    const timeRangeLabel = isMorning
      ? `Morning (Before ${formatTimeStr12h(GTA_AFTERNOON_DIVIDING_TIME)})`
      : `Afternoon (${formatTimeStr12h(GTA_AFTERNOON_DIVIDING_TIME)} & Later)`

    blocks.push({
      date: dateStr,
      dayOfWeek,
      dayName,
      blockType,
      blockLabel,
      timeRangeLabel,
      slots
    })
  }

  // Sort blocks chronologically (by date, then MORNING before AFTERNOON)
  return blocks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.blockType === 'MORNING' ? -1 : 1
  })
}
