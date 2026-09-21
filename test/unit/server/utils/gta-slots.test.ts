import { describe, it, expect } from 'vitest'
import {
  calculateGtaSlotsForShifts,
  GTA_INTERVIEW_MIN_LEAD_HOURS,
  DEFAULT_GTA_TIMEZONE
} from '../../../../server/utils/gta-slots'
import { combineDateAndTime } from '../../../../server/utils/cbtf'

describe('Server Utility: calculateGtaSlotsForShifts', () => {
  // Monday 8:00 AM EDT (UTC-4) = 12:00 PM UTC
  const referenceNow = new Date('2026-10-05T12:00:00.000Z')

  it('generates 10-minute slots with 5-minute interview duration for a 1-hour shift in EDT', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      }
    ]

    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, referenceNow)

    expect(blocks).toHaveLength(1)
    const morningBlock = blocks[0]
    expect(morningBlock.id).toBe('2026-10-05-morning')
    expect(morningBlock.blockType).toBe('MORNING')
    expect(morningBlock.date).toBe('2026-10-05')
    expect(morningBlock.dayName).toBe('Monday')
    expect(morningBlock.label).toBe('Monday Morning')
    expect(morningBlock.blockLabel).toBe('Monday Morning')
    expect(morningBlock.dateLabel).toBe('Oct 5')
    expect(morningBlock.timeRangeLabel).toBe('Morning (Before 12:30 PM)')
    expect(morningBlock.openSlotsCount).toBe(6)
    expect(morningBlock.totalSlotsCount).toBe(6)
    expect(morningBlock.utilizationPercentage).toBe(0)
    expect(morningBlock.isHighDemand).toBe(false)

    // 10:00, 10:10, 10:20, 10:30, 10:40, 10:50 (6 slots)
    expect(morningBlock.slots).toHaveLength(6)

    // In America/New_York (EDT = UTC-4), 10:00 AM EDT is 14:00:00.000Z in UTC
    expect(morningBlock.slots[0]).toEqual({
      startTime: '2026-10-05T14:00:00.000Z',
      endTime: '2026-10-05T14:05:00.000Z',
      time24: '10:00',
      label: '10:00 AM – 10:05 AM',
      availableGtaCount: 1,
      totalGtaCount: 1
    })

    expect(morningBlock.slots[5]).toEqual({
      startTime: '2026-10-05T14:50:00.000Z',
      endTime: '2026-10-05T14:55:00.000Z',
      time24: '10:50',
      label: '10:50 AM – 10:55 AM',
      availableGtaCount: 1,
      totalGtaCount: 1
    })
  })

  it('interprets 12:00 PM shift in EDT as 16:00 UTC (not naive 12:00 UTC)', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-09-21',
        startTime: '12:00',
        endTime: '14:00'
      }
    ]

    // 9:00 AM EDT = 13:00 UTC
    const morningNow = new Date('2026-09-21T13:00:00.000Z')
    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, morningNow)

    // Shift spans across 12:30 dividing time, so it creates Morning and Afternoon blocks
    expect(blocks).toHaveLength(2)
    const morning = blocks.find((b) => b.blockType === 'MORNING')
    expect(morning).toBeDefined()
    const slot1200 = morning!.slots[0]
    expect(slot1200.time24).toBe('12:00')
    expect(slot1200.label).toBe('12:00 PM – 12:05 PM')
    // Crucial check: 12:00 PM EDT must be 16:00:00.000Z (true UTC), NOT 12:00:00.000Z
    expect(slot1200.startTime).toBe('2026-09-21T16:00:00.000Z')
    expect(slot1200.endTime).toBe('2026-09-21T16:05:00.000Z')
  })

  it('calculates aggregated capacity for overlapping GTA shifts', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      },
      {
        userId: 'gta-2',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '12:00'
      }
    ]

    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, referenceNow)

    expect(blocks).toHaveLength(1)
    const slots = blocks[0].slots

    // 10:00 slot has both GTAs
    const slot1000 = slots.find((s) => s.time24 === '10:00')
    expect(slot1000?.totalGtaCount).toBe(2)
    expect(slot1000?.availableGtaCount).toBe(2)

    // 11:00 slot has only GTA 2
    const slot1100 = slots.find((s) => s.time24 === '11:00')
    expect(slot1100?.totalGtaCount).toBe(1)
    expect(slot1100?.availableGtaCount).toBe(1)
  })

  it('correctly subtracts active reservations and excludes fully booked slots', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      },
      {
        userId: 'gta-2',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      }
    ]

    const existingReservations = [
      // 1 reservation at 10:10 EDT (14:10 UTC) with GTA 1
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T14:10:00.000Z',
        status: 'SCHEDULED'
      },
      // 2 reservations at 10:20 EDT (14:20 UTC) (both GTAs booked)
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T14:20:00.000Z',
        status: 'SCHEDULED'
      },
      {
        gtaId: 'gta-2',
        startTime: '2026-10-05T14:20:00.000Z',
        status: 'SCHEDULED'
      },
      // 1 cancelled reservation at 10:30 EDT (should NOT occupy capacity)
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T14:30:00.000Z',
        status: 'CANCELLED'
      }
    ]

    const blocks = calculateGtaSlotsForShifts(
      shifts,
      existingReservations,
      null,
      null,
      referenceNow
    )
    const slots = blocks[0].slots

    // 10:10 has 1 of 2 slots available
    const slot1010 = slots.find((s) => s.time24 === '10:10')
    expect(slot1010?.totalGtaCount).toBe(2)
    expect(slot1010?.availableGtaCount).toBe(1)

    // 10:20 is fully booked and should be excluded
    const slot1020 = slots.find((s) => s.time24 === '10:20')
    expect(slot1020).toBeUndefined()

    // 10:30 has both slots available because cancelled reservation is ignored
    const slot1030 = slots.find((s) => s.time24 === '10:30')
    expect(slot1030?.availableGtaCount).toBe(2)
  })

  it('separates morning (<12:30) and afternoon (>=12:30) blocks', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '11:00',
        endTime: '14:00'
      }
    ]

    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, referenceNow)

    expect(blocks).toHaveLength(2)
    const morning = blocks.find((b) => b.blockType === 'MORNING')
    const afternoon = blocks.find((b) => b.blockType === 'AFTERNOON')

    expect(morning).toBeDefined()
    expect(afternoon).toBeDefined()

    // Morning ends at 12:20 (12:20-12:25)
    expect(morning!.slots[morning!.slots.length - 1].time24).toBe('12:20')

    // Afternoon starts at 12:30 (12:30-12:35)
    expect(afternoon!.slots[0].time24).toBe('12:30')
  })

  it('filters slots by assignment interview window', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '12:00'
      }
    ]

    // In EDT (UTC-4), 10:30 EDT is 14:30 UTC and 11:15 EDT is 15:15 UTC
    const windowStart = new Date('2026-10-05T14:30:00.000Z')
    const windowEnd = new Date('2026-10-05T15:15:00.000Z')

    const blocks = calculateGtaSlotsForShifts(shifts, [], windowStart, windowEnd, referenceNow)

    expect(blocks).toHaveLength(1)
    const slots = blocks[0].slots

    // Should only contain 10:30, 10:40, 10:50, 11:00, 11:10
    expect(slots[0].time24).toBe('10:30')
    expect(slots[slots.length - 1].time24).toBe('11:10')
  })

  it('excludes slots occurring less than 2 hours in the future relative to now', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      }
    ]

    // At 8:25 AM EDT (12:25 UTC), 2 hours in the future is 10:25 AM EDT (14:25 UTC)
    // Slots at 10:00, 10:10, 10:20 (14:00, 14:10, 14:20 UTC) are within 2 hours and must be excluded; 10:30 is the first available slot
    const leadNow = new Date('2026-10-05T12:25:00.000Z')
    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, leadNow)

    expect(blocks).toHaveLength(1)
    const slots = blocks[0].slots

    expect(slots[0].time24).toBe('10:30')
    expect(slots).toHaveLength(3) // 10:30, 10:40, 10:50
  })

  it('excludes slots that are only 15 minutes in the future', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      }
    ]

    // At 9:45 AM EDT (13:45 UTC), 10:00 AM EDT slot is 15 minutes away - it should be excluded because min lead is 2 hours
    const leadNow = new Date('2026-10-05T13:45:00.000Z')
    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, leadNow)

    expect(blocks).toHaveLength(0)
  })

  it('exports GTA_INTERVIEW_MIN_LEAD_HOURS set to 2', () => {
    expect(GTA_INTERVIEW_MIN_LEAD_HOURS).toBe(2)
  })

  it('exports DEFAULT_GTA_TIMEZONE as America/New_York', () => {
    expect(DEFAULT_GTA_TIMEZONE).toBe('America/New_York')
  })

  it('caps lookahead to the next 4 available half-day blocks when utilization is <= 75%', () => {
    const shifts = [
      { userId: 'gta-1', date: '2026-10-05', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-06', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-07', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-08', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-09', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-10', startTime: '10:00', endTime: '11:00' }
    ]

    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, referenceNow)

    expect(blocks).toHaveLength(4)
    expect(blocks.map((b) => b.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08'
    ])
  })

  it('expands lookahead to 5 blocks when all initial blocks have utilization > 75%', () => {
    const shifts = [
      { userId: 'gta-1', date: '2026-10-05', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-06', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-07', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-08', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-09', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-10', startTime: '10:00', endTime: '11:00' }
    ]

    // In the first 4 blocks, book 5 of 6 slots (utilization = 83% > 75%)
    const reservations: any[] = []
    const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
    const times = ['10:00', '10:10', '10:20', '10:30', '10:40']
    for (const d of dates) {
      for (const t of times) {
        reservations.push({
          gtaId: 'gta-1',
          startTime: combineDateAndTime(d, t, 'America/New_York').toISOString(),
          status: 'SCHEDULED'
        })
      }
    }

    const blocks = calculateGtaSlotsForShifts(shifts, reservations, null, null, referenceNow)

    expect(blocks).toHaveLength(5)
    expect(blocks.map((b) => b.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09'
    ])
  })

  it('includes current in-progress block in addition to future lookahead blocks', () => {
    // Current time is Monday 10:00 AM EDT (14:00 UTC).
    // Shift is 10:00 - 12:30 (slots from 10:00 to 12:20 EDT).
    // Min lead time is 2 hours, so slots at 12:00, 12:10, 12:20 are open.
    // Monday morning is currently in-progress (10:00 <= 10:00 < 12:30).
    const midMorningNow = new Date('2026-10-05T14:00:00.000Z')
    const shifts = [
      { userId: 'gta-1', date: '2026-10-05', startTime: '10:00', endTime: '12:30' },
      { userId: 'gta-1', date: '2026-10-06', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-07', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-08', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-09', startTime: '10:00', endTime: '11:00' },
      { userId: 'gta-1', date: '2026-10-10', startTime: '10:00', endTime: '11:00' }
    ]

    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, midMorningNow)

    // Current block (Monday morning) + 4 future blocks = 5 blocks total
    expect(blocks).toHaveLength(5)
    expect(blocks[0].isCurrentBlock).toBe(true)
    expect(blocks[0].date).toBe('2026-10-05')
    expect(blocks[0].blockType).toBe('MORNING')
    expect(blocks[1].isCurrentBlock).toBe(false)
    expect(blocks[4].date).toBe('2026-10-09')
  })
})
