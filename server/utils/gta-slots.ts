import { formatTimeStr12h } from '@@/shared/utils/proctor-schedule-parser'
import { combineDateAndTime, getLocalDayOfWeek, DEFAULT_CBTF_TIMEZONE } from '@@/server/utils/cbtf'

export const DEFAULT_GTA_TIMEZONE = DEFAULT_CBTF_TIMEZONE
export const INTERVIEW_SLOT_INTERVAL_MINUTES = 10
export const INTERVIEW_DURATION_MINUTES = 5
export const GTA_AFTERNOON_DIVIDING_TIME = '12:30'
export const GTA_INTERVIEW_MIN_LEAD_HOURS = 2
export const GTA_INTERVIEW_MIN_LEAD_MS = GTA_INTERVIEW_MIN_LEAD_HOURS * 60 * 60 * 1000

export const GTA_LOOKAHEAD_BLOCKS_DEFAULT = 4
export const GTA_LOOKAHEAD_BLOCKS_HIGH_DEMAND = 5
export const GTA_HIGH_DEMAND_UTILIZATION_THRESHOLD = 75

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
  isCurrentBlock?: boolean
  openSlotsCount?: number
  totalSlotsCount?: number
  utilizationPercentage?: number
  isHighDemand?: boolean
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
 * Shift times are interpreted in the specified timezone (default America/New_York).
 */
export function calculateGtaSlotsForShifts(
  shifts: ShiftInput[],
  existingReservations: ReservationInput[] = [],
  windowStart?: Date | string | null,
  windowEnd?: Date | string | null,
  now: Date = new Date(),
  minLeadHours: number = GTA_INTERVIEW_MIN_LEAD_HOURS,
  timeZone: string = DEFAULT_GTA_TIMEZONE
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
      const slotStartDate = combineDateAndTime(dStr, time24, timeZone)
      const slotStartIso = slotStartDate.toISOString()

      const endM = m + INTERVIEW_DURATION_MINUTES
      const endH = Math.floor(endM / 60)
      const endMin = endM % 60
      const endTime24 = `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      const endSlotDate = combineDateAndTime(dStr, endTime24, timeZone)
      const endSlotIso = endSlotDate.toISOString()

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

  const minLeadMs = minLeadHours * 60 * 60 * 1000
  const minAllowedSlotTime = new Date(now.getTime() + minLeadMs)

  for (const [slotStartIso, gtaSet] of slotGtasMap.entries()) {
    const slotStartDate = new Date(slotStartIso)

    // Must be at least minLeadHours (2 hours) in the future
    if (slotStartDate < minAllowedSlotTime) continue

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
  const candidateBlocks: GtaHalfDayBlock[] = []

  for (const [blockKey, slots] of blocksMap.entries()) {
    if (slots.length === 0) continue

    const [dateStr, blockType] = blockKey.split('_') as [string, 'MORNING' | 'AFTERNOON']
    const dayOfWeek = getLocalDayOfWeek(combineDateAndTime(dateStr, '12:00', timeZone), timeZone)
    const dayName = DAY_NAMES[dayOfWeek]

    // Sort slots chronologically
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime))

    const isMorning = blockType === 'MORNING'
    const blockLabel = `${dayName} ${isMorning ? 'Morning' : 'Afternoon'}`
    const timeRangeLabel = isMorning
      ? `Morning (Before ${formatTimeStr12h(GTA_AFTERNOON_DIVIDING_TIME)})`
      : `Afternoon (${formatTimeStr12h(GTA_AFTERNOON_DIVIDING_TIME)} & Later)`

    // Collect theoretical slots for this block to determine total count and boundaries
    const blockTheoreticalMeta = Array.from(slotMetaMap.values())
      .filter((meta) => {
        const isM = meta.time24 < GTA_AFTERNOON_DIVIDING_TIME
        return `${meta.dateStr}_${isM ? 'MORNING' : 'AFTERNOON'}` === blockKey
      })
      .sort((a, b) => a.time24.localeCompare(b.time24))

    const blockStart = isMorning
      ? blockTheoreticalMeta.length > 0
        ? combineDateAndTime(dateStr, blockTheoreticalMeta[0].time24, timeZone)
        : combineDateAndTime(dateStr, '00:00', timeZone)
      : combineDateAndTime(dateStr, GTA_AFTERNOON_DIVIDING_TIME, timeZone)

    const blockEnd = isMorning
      ? combineDateAndTime(dateStr, GTA_AFTERNOON_DIVIDING_TIME, timeZone)
      : blockTheoreticalMeta.length > 0
        ? combineDateAndTime(
            dateStr,
            blockTheoreticalMeta[blockTheoreticalMeta.length - 1].endTime24,
            timeZone
          )
        : combineDateAndTime(dateStr, '23:59', timeZone)

    const isCurrentBlock = now >= blockStart && now < blockEnd

    const totalSlotsCount = blockTheoreticalMeta.length || slots.length
    const openSlotsCount = slots.length
    const utilizationPercentage =
      totalSlotsCount > 0
        ? Math.max(
            0,
            Math.min(100, Math.round(((totalSlotsCount - openSlotsCount) / totalSlotsCount) * 100))
          )
        : 100
    const isHighDemand = utilizationPercentage > 60

    candidateBlocks.push({
      date: dateStr,
      dayOfWeek,
      dayName,
      blockType,
      blockLabel,
      timeRangeLabel,
      slots,
      isCurrentBlock,
      openSlotsCount,
      totalSlotsCount,
      utilizationPercentage,
      isHighDemand
    })
  }

  // Sort candidate blocks chronologically (by date, then MORNING before AFTERNOON)
  const sortedBlocks = candidateBlocks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.blockType === 'MORNING' ? -1 : 1
  })

  // Identify current in-progress block vs future blocks
  const currentBlock = sortedBlocks.find((b) => b.isCurrentBlock)
  const futureBlocks = sortedBlocks.filter((b) => !b.isCurrentBlock)

  // Evaluate initial lookahead blocks: current (if active) + next 4
  const initialLookaheadBlocks = currentBlock
    ? [currentBlock, ...futureBlocks.slice(0, GTA_LOOKAHEAD_BLOCKS_DEFAULT)]
    : futureBlocks.slice(0, GTA_LOOKAHEAD_BLOCKS_DEFAULT)

  // If all evaluated blocks have utilization > 75%, show next 5 blocks instead of 4
  const allAbove75 =
    initialLookaheadBlocks.length > 0 &&
    initialLookaheadBlocks.every(
      (b) => (b.utilizationPercentage ?? 0) > GTA_HIGH_DEMAND_UTILIZATION_THRESHOLD
    )

  const futureCount = allAbove75 ? GTA_LOOKAHEAD_BLOCKS_HIGH_DEMAND : GTA_LOOKAHEAD_BLOCKS_DEFAULT

  const selectedBlocks = currentBlock
    ? [currentBlock, ...futureBlocks.slice(0, futureCount)]
    : futureBlocks.slice(0, futureCount)

  return selectedBlocks
}
