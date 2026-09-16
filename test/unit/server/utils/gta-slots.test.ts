import { describe, it, expect } from 'vitest'
import { calculateGtaSlotsForShifts } from '../../../../server/utils/gta-slots'

describe('Server Utility: calculateGtaSlotsForShifts', () => {
  const referenceNow = new Date('2026-10-05T08:00:00.000Z') // Monday 8:00 AM UTC

  it('generates 10-minute slots with 5-minute interview duration for a 1-hour shift', () => {
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
    expect(morningBlock.blockType).toBe('MORNING')
    expect(morningBlock.date).toBe('2026-10-05')
    expect(morningBlock.dayName).toBe('Monday')

    // 10:00, 10:10, 10:20, 10:30, 10:40, 10:50 (6 slots)
    expect(morningBlock.slots).toHaveLength(6)

    expect(morningBlock.slots[0]).toEqual({
      startTime: '2026-10-05T10:00:00.000Z',
      endTime: '2026-10-05T10:05:00.000Z',
      time24: '10:00',
      label: '10:00 AM – 10:05 AM',
      availableGtaCount: 1,
      totalGtaCount: 1
    })

    expect(morningBlock.slots[5]).toEqual({
      startTime: '2026-10-05T10:50:00.000Z',
      endTime: '2026-10-05T10:55:00.000Z',
      time24: '10:50',
      label: '10:50 AM – 10:55 AM',
      availableGtaCount: 1,
      totalGtaCount: 1
    })
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
      // 1 reservation at 10:10 with GTA 1
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T10:10:00.000Z',
        status: 'SCHEDULED'
      },
      // 2 reservations at 10:20 (both GTAs booked)
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T10:20:00.000Z',
        status: 'SCHEDULED'
      },
      {
        gtaId: 'gta-2',
        startTime: '2026-10-05T10:20:00.000Z',
        status: 'SCHEDULED'
      },
      // 1 cancelled reservation at 10:30 (should NOT occupy capacity)
      {
        gtaId: 'gta-1',
        startTime: '2026-10-05T10:30:00.000Z',
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

    const windowStart = new Date('2026-10-05T10:30:00.000Z')
    const windowEnd = new Date('2026-10-05T11:15:00.000Z')

    const blocks = calculateGtaSlotsForShifts(shifts, [], windowStart, windowEnd, referenceNow)

    expect(blocks).toHaveLength(1)
    const slots = blocks[0].slots

    // Should only contain 10:30, 10:40, 10:50, 11:00, 11:10
    expect(slots[0].time24).toBe('10:30')
    expect(slots[slots.length - 1].time24).toBe('11:10')
  })

  it('excludes slots occurring in the past relative to now', () => {
    const shifts = [
      {
        userId: 'gta-1',
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      }
    ]

    const midShiftNow = new Date('2026-10-05T10:25:00.000Z')
    const blocks = calculateGtaSlotsForShifts(shifts, [], null, null, midShiftNow)

    expect(blocks).toHaveLength(1)
    const slots = blocks[0].slots

    // First available slot must be 10:30 (after 10:25)
    expect(slots[0].time24).toBe('10:30')
  })
})
