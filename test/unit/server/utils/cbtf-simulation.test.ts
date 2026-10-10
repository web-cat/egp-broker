import { describe, it, expect } from 'vitest'
import {
  calculatePhasedSeats,
  calculateMaxArrivalsPerSlot,
  generateAvailableSlotsForDate,
  assignNextSeat,
  isSeatFreeInWindow
} from '../../../../server/utils/cbtf'

describe('CBTF High-Throughput Concurrency & Simulation Tests (REQ-611)', () => {
  // Facility configuration: 20 workstations, 2 elastic hot-spares, 18 phased seats
  const totalSeats = 20
  const elasticSeatCount = 2
  const phasedSeatCount = calculatePhasedSeats(totalSeats, elasticSeatCount) // 18
  const seatAllocationOrder = Array.from({ length: totalSeats }, (_, i) => i + 1) // [1..20]

  const operatingHours = [
    {
      dayOfWeek: 1, // Monday
      openTime: '08:00',
      closeTime: '18:00'
    }
  ]

  const hours = {
    isOpen: true,
    openTime: '08:00',
    closeTime: '18:00',
    reason: null
  }

  const facility = {
    id: 'fac-main',
    name: 'Main CBTF Center',
    totalSeats,
    elasticSeatCount,
    operatingHours,
    exceptions: [],
    seatAllocationOrder
  }

  // 2026-10-12 is a Monday in EDT (America/New_York is UTC-4).
  // 08:00 EDT = 12:00 UTC, 09:00 EDT = 13:00 UTC, 10:00 EDT = 14:00 UTC.
  const testDate = new Date('2026-10-12T00:00:00.000Z')

  describe('60-Minute Exam Full-Capacity Simulation (18 students/hour)', () => {
    it('achieves 100% capacity utilization across back-to-back hours with zero phantom dropouts (REQ-611)', () => {
      interface ActiveReservation {
        id: string
        startTime: Date
        endTime: Date
        seatNumber: number
      }

      const activeReservations: ActiveReservation[] = []

      // --- HOUR 1: 08:00 to 09:00 EDT (12:00 to 13:00 UTC) ---
      const hour1Slots = generateAvailableSlotsForDate(
        facility as any,
        testDate,
        hours,
        activeReservations,
        undefined,
        60
      ).filter(
        (s) =>
          new Date(s.startTime) >= new Date('2026-10-12T12:00:00.000Z') &&
          new Date(s.startTime) < new Date('2026-10-12T13:00:00.000Z')
      )

      expect(hour1Slots).toHaveLength(12) // :00 through :55 (12 arrival offsets)

      // Book full quota for each offset in Hour 1
      let studentIndex = 1
      for (const slot of hour1Slots) {
        const slotStart = new Date(slot.startTime)
        const slotEnd = new Date(slot.endTime)
        const offset = Math.floor(slotStart.getUTCMinutes() / 5)
        const maxArrivals = calculateMaxArrivalsPerSlot(totalSeats, offset, 60, elasticSeatCount)

        // Alternate 2-1 pattern: sum across 12 offsets = 18
        expect([1, 2]).toContain(maxArrivals)

        for (let a = 0; a < maxArrivals; a++) {
          const seat = assignNextSeat(
            seatAllocationOrder,
            slotStart,
            slotEnd,
            activeReservations,
            null,
            60,
            elasticSeatCount
          )

          expect(seat).toBeLessThanOrEqual(phasedSeatCount) // Must be <= 18 (never hot-spare 19, 20)
          activeReservations.push({
            id: `student-${studentIndex++}`,
            startTime: slotStart,
            endTime: slotEnd,
            seatNumber: seat
          })
        }
      }

      expect(activeReservations).toHaveLength(18)

      // Verify all 18 phased seats (1..18) are occupied in Hour 1, and 19 & 20 are completely free
      const hour1Seats = new Set(activeReservations.map((r) => r.seatNumber))
      expect(hour1Seats.size).toBe(18)
      expect(hour1Seats.has(19)).toBe(false)
      expect(hour1Seats.has(20)).toBe(false)

      // Verify Hour 1 is now fully saturated: any further booking attempt at any offset in Hour 1 fails
      for (const slot of hour1Slots) {
        const slotStart = new Date(slot.startTime)
        const slotEnd = new Date(slot.endTime)
        const activeInWindow = activeReservations.filter(
          (r) => slotStart < r.endTime && slotEnd > r.startTime
        )

        expect(() =>
          assignNextSeat(
            seatAllocationOrder,
            slotStart,
            slotEnd,
            activeInWindow,
            null,
            60,
            elasticSeatCount
          )
        ).toThrow('No unallocated seats available at this time slot')
      }

      // --- HOUR 2: 09:00 to 10:00 EDT (13:00 to 14:00 UTC) (Back-to-back turnover) ---
      // Crucial test of REQ-611: At 09:00 EDT (13:00 UTC), the students who arrived at 08:00 have vacated.
      // The 115-minute rolling window algorithm would falsely consider 08:00 reservations still active!
      // The new seat-interval algorithm recognizes 09:00 seats as 100% available!
      const hour2Slots = generateAvailableSlotsForDate(
        facility as any,
        testDate,
        hours,
        activeReservations,
        undefined,
        60
      ).filter(
        (s) =>
          new Date(s.startTime) >= new Date('2026-10-12T13:00:00.000Z') &&
          new Date(s.startTime) < new Date('2026-10-12T14:00:00.000Z')
      )

      expect(hour2Slots).toHaveLength(12) // All 12 arrival offsets must be available

      for (const slot of hour2Slots) {
        const slotStart = new Date(slot.startTime)
        const slotEnd = new Date(slot.endTime)
        const offset = Math.floor(slotStart.getUTCMinutes() / 5)
        const maxArrivals = calculateMaxArrivalsPerSlot(totalSeats, offset, 60, elasticSeatCount)

        for (let a = 0; a < maxArrivals; a++) {
          const activeInWindow = activeReservations.filter(
            (r) => slotStart < r.endTime && slotEnd > r.startTime
          )

          const seat = assignNextSeat(
            seatAllocationOrder,
            slotStart,
            slotEnd,
            activeInWindow,
            null,
            60,
            elasticSeatCount
          )

          expect(seat).toBeLessThanOrEqual(phasedSeatCount) // Never hot spares
          activeReservations.push({
            id: `student-${studentIndex++}`,
            startTime: slotStart,
            endTime: slotEnd,
            seatNumber: seat
          })
        }
      }

      // 18 students from Hour 1 + 18 students from Hour 2 = 36 total students served
      expect(activeReservations).toHaveLength(36)

      // Verify no collisions between any reservations overlapping in time
      for (let i = 0; i < activeReservations.length; i++) {
        for (let j = i + 1; j < activeReservations.length; j++) {
          const r1 = activeReservations[i]
          const r2 = activeReservations[j]
          const overlaps = r1.startTime < r2.endTime && r1.endTime > r2.startTime
          if (overlaps) {
            expect(r1.seatNumber).not.toBe(r2.seatNumber)
          }
        }
      }
    })
  })

  describe('30-Minute Quiz High-Density Simulation (36 students/hour)', () => {
    it('achieves 36 arrivals per hour with 3 students per offset and zero schedule holes (REQ-611)', () => {
      interface ActiveReservation {
        id: string
        startTime: Date
        endTime: Date
        seatNumber: number
      }

      const activeReservations: ActiveReservation[] = []

      // Half-hour Cycle 1 (08:00 - 08:30 EDT / 12:00 - 12:30 UTC) and Cycle 2 (08:30 - 09:00 EDT / 12:30 - 13:00 UTC)
      const hourSlots = generateAvailableSlotsForDate(
        facility as any,
        testDate,
        hours,
        activeReservations,
        undefined,
        30
      ).filter(
        (s) =>
          new Date(s.startTime) >= new Date('2026-10-12T12:00:00.000Z') &&
          new Date(s.startTime) < new Date('2026-10-12T13:00:00.000Z')
      )

      expect(hourSlots).toHaveLength(12) // 12 slots in 1 hour

      let studentCount = 0
      for (const slot of hourSlots) {
        const slotStart = new Date(slot.startTime)
        const slotEnd = new Date(slot.endTime)
        const offset = Math.floor(slotStart.getUTCMinutes() / 5)
        const maxArrivals = calculateMaxArrivalsPerSlot(totalSeats, offset, 30, elasticSeatCount)

        // In 30m mode with 18 phased seats, every offset gets exactly 3 arrivals
        expect(maxArrivals).toBe(3)

        for (let a = 0; a < maxArrivals; a++) {
          const activeInWindow = activeReservations.filter(
            (r) => slotStart < r.endTime && slotEnd > r.startTime
          )

          const seat = assignNextSeat(
            seatAllocationOrder,
            slotStart,
            slotEnd,
            activeInWindow,
            null,
            30,
            elasticSeatCount
          )

          expect(seat).toBeLessThanOrEqual(18) // Never touches 19, 20
          activeReservations.push({
            id: `quiz-student-${++studentCount}`,
            startTime: slotStart,
            endTime: slotEnd,
            seatNumber: seat
          })
        }
      }

      // Exactly 36 students accommodated in 1 hour (2x the 60-minute capacity!)
      expect(activeReservations).toHaveLength(36)

      // Verify no seat overlap collisions
      for (let i = 0; i < activeReservations.length; i++) {
        for (let j = i + 1; j < activeReservations.length; j++) {
          const r1 = activeReservations[i]
          const r2 = activeReservations[j]
          const overlaps = r1.startTime < r2.endTime && r1.endTime > r2.startTime
          if (overlaps) {
            expect(r1.seatNumber).not.toBe(r2.seatNumber)
          }
        }
      }
    })
  })

  describe('Emergency Workstation Failover & Hot-Spare Invariants', () => {
    it('permits proctor hot-spare reassignment to Seat 19 and frees faulty workstation without schedule disruption', () => {
      // 18 students occupying Seats 1..18 during 12:00-13:00 UTC
      const slotStart = new Date('2026-10-12T12:00:00.000Z')
      const slotEnd = new Date('2026-10-12T13:00:00.000Z')

      const activeReservations = Array.from({ length: 18 }, (_, i) => ({
        id: `student-${i + 1}`,
        startTime: slotStart,
        endTime: slotEnd,
        seatNumber: i + 1
      }))

      // Automated assignment confirms all 18 phased seats are full
      expect(() =>
        assignNextSeat(
          seatAllocationOrder,
          slotStart,
          slotEnd,
          activeReservations,
          null,
          60,
          elasticSeatCount
        )
      ).toThrow('No unallocated seats available at this time slot')

      // Workstation #4 experiences a hardware failure mid-session.
      // Proctor reassigns student-4 from Seat 4 to Hot-Spare Seat 19.
      const student4 = activeReservations.find((r) => r.seatNumber === 4)!
      expect(student4).toBeDefined()

      // Verify Hot-Spare Seat 19 is free in this window
      expect(isSeatFreeInWindow(19, slotStart, slotEnd, activeReservations)).toBe(true)
      expect(isSeatFreeInWindow(20, slotStart, slotEnd, activeReservations)).toBe(true)

      // Perform the swap
      student4.seatNumber = 19

      // 1. Hot spare 19 is now occupied
      expect(isSeatFreeInWindow(19, slotStart, slotEnd, activeReservations)).toBe(false)
      // 2. Faulty seat 4 is now freed in the reservation roster
      expect(isSeatFreeInWindow(4, slotStart, slotEnd, activeReservations)).toBe(true)
      // 3. Hot spare 20 is still free
      expect(isSeatFreeInWindow(20, slotStart, slotEnd, activeReservations)).toBe(true)

      // A student arriving later in the slot can now be assigned to Seat 4
      const nextSeat = assignNextSeat(
        seatAllocationOrder,
        slotStart,
        slotEnd,
        activeReservations,
        null,
        60,
        elasticSeatCount
      )
      expect(nextSeat).toBe(4)
    })
  })
})
