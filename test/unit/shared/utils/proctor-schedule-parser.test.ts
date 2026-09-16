import { describe, it, expect } from 'vitest'
import {
  parseProctorShiftString,
  calculateWeeklyShiftHours,
  formatTimeStr12h,
  formatShiftDuration,
  formatShiftDate,
  type ParsedShiftSlot
} from '../../../../shared/utils/proctor-schedule-parser'

describe('Proctor Schedule Parser', () => {
  describe('parseProctorShiftString', () => {
    it('parses typical multi-day shift string from proctor-schedule.md', () => {
      const input = 'Mon 2:00–5:00 PM (3.0h), Wed 9:00–11:30 AM (2.5h), Fri 9:00–11:30 AM (2.5h)'
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(3)

      expect(result[0]).toEqual({
        dayOfWeek: 1,
        dayName: 'Monday',
        startTime: '14:00',
        endTime: '17:00',
        durationHours: 3.0
      })

      expect(result[1]).toEqual({
        dayOfWeek: 3,
        dayName: 'Wednesday',
        startTime: '09:00',
        endTime: '11:30',
        durationHours: 2.5
      })

      expect(result[2]).toEqual({
        dayOfWeek: 5,
        dayName: 'Friday',
        startTime: '09:00',
        endTime: '11:30',
        durationHours: 2.5
      })
    })

    it('parses shifts spanning morning into afternoon (e.g. 11:30 AM–2:30 PM)', () => {
      const input = 'Wed 11:30 AM–2:30 PM (3.0h), Thu 11:30 AM–2:30 PM (3.0h)'
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(2)

      expect(result[0]).toEqual({
        dayOfWeek: 3,
        dayName: 'Wednesday',
        startTime: '11:30',
        endTime: '14:30',
        durationHours: 3.0
      })

      expect(result[1]).toEqual({
        dayOfWeek: 4,
        dayName: 'Thursday',
        startTime: '11:30',
        endTime: '14:30',
        durationHours: 3.0
      })
    })

    it('parses multi-line input and hyphen delimiters', () => {
      const input = `Mon 9:00 AM - 11:00 AM
Tue 12:00 PM - 2:00 PM
Fri 2:00 PM - 5:00 PM`
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(3)
      expect(result[0].dayOfWeek).toBe(1)
      expect(result[0].startTime).toBe('09:00')
      expect(result[0].endTime).toBe('11:00')

      expect(result[1].dayOfWeek).toBe(2)
      expect(result[1].startTime).toBe('12:00')
      expect(result[1].endTime).toBe('14:00')

      expect(result[2].dayOfWeek).toBe(5)
      expect(result[2].startTime).toBe('14:00')
      expect(result[2].endTime).toBe('17:00')
    })

    it('infers PM for start time if only end time has PM and start <= end (e.g. 2:00-5:00 PM)', () => {
      const input = 'Mon 2:00 - 5:00 PM'
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(1)
      expect(result[0].startTime).toBe('14:00')
      expect(result[0].endTime).toBe('17:00')
      expect(result[0].durationHours).toBe(3.0)
    })

    it('handles 24-hour time format', () => {
      const input = 'Mon 09:00 - 17:00'
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(1)
      expect(result[0].startTime).toBe('09:00')
      expect(result[0].endTime).toBe('17:00')
      expect(result[0].durationHours).toBe(8.0)
    })

    it('ignores invalid chunks gracefully', () => {
      const input = 'Not a shift, Mon 10:00 AM - 12:00 PM, Random note'
      const result = parseProctorShiftString(input)

      expect(result).toHaveLength(1)
      expect(result[0].dayOfWeek).toBe(1)
      expect(result[0].startTime).toBe('10:00')
      expect(result[0].endTime).toBe('12:00')
    })

    it('returns empty array for empty or whitespace string', () => {
      expect(parseProctorShiftString('')).toEqual([])
      expect(parseProctorShiftString('   \n  ')).toEqual([])
    })
  })

  describe('calculateWeeklyShiftHours', () => {
    it('sums duration of all parsed slots correctly', () => {
      const slots: ParsedShiftSlot[] = [
        {
          dayOfWeek: 1,
          dayName: 'Monday',
          startTime: '14:00',
          endTime: '17:00',
          durationHours: 3.0
        },
        {
          dayOfWeek: 3,
          dayName: 'Wednesday',
          startTime: '09:00',
          endTime: '11:30',
          durationHours: 2.5
        },
        {
          dayOfWeek: 5,
          dayName: 'Friday',
          startTime: '09:00',
          endTime: '11:30',
          durationHours: 2.5
        }
      ]
      expect(calculateWeeklyShiftHours(slots)).toBe(8.0)
    })
  })

  describe('formatTimeStr12h', () => {
    it('formats morning, afternoon, and noon/midnight times correctly', () => {
      expect(formatTimeStr12h('09:00')).toBe('9:00 AM')
      expect(formatTimeStr12h('11:30')).toBe('11:30 AM')
      expect(formatTimeStr12h('12:00')).toBe('12:00 PM')
      expect(formatTimeStr12h('14:00')).toBe('2:00 PM')
      expect(formatTimeStr12h('17:00')).toBe('5:00 PM')
      expect(formatTimeStr12h('00:00')).toBe('12:00 AM')
    })
  })

  describe('formatShiftDuration', () => {
    it('calculates and formats shift duration', () => {
      expect(formatShiftDuration('14:00', '17:00')).toBe('3.0h')
      expect(formatShiftDuration('09:00', '11:30')).toBe('2.5h')
      expect(formatShiftDuration('09:00', '11:00')).toBe('2.0h')
    })
  })

  describe('formatShiftDate', () => {
    it('formats UTC ISO date string into human-readable date', () => {
      expect(formatShiftDate('2026-09-16T00:00:00.000Z')).toBe('Wed, Sep 16, 2026')
      expect(formatShiftDate('2026-12-09T00:00:00.000Z')).toBe('Wed, Dec 9, 2026')
    })
  })
})
