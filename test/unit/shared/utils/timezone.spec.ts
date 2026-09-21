import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  DEFAULT_CBTF_TIMEZONE,
  DEFAULT_GTA_TIMEZONE,
  getLocalDateString,
  extractCalendarDate,
  getLocalDayOfWeek,
  getLocalTimeParts,
  combineDateAndTime
} from '@@/shared/utils/timezone'

describe('Centralized Timezone Utilities', () => {
  describe('Constants', () => {
    it('sets America/New_York as canonical default timezone', () => {
      expect(DEFAULT_TIMEZONE).toBe('America/New_York')
      expect(DEFAULT_CBTF_TIMEZONE).toBe(DEFAULT_TIMEZONE)
      expect(DEFAULT_GTA_TIMEZONE).toBe(DEFAULT_TIMEZONE)
    })
  })

  describe('getLocalDateString', () => {
    it('formats date in America/New_York across midnight boundary in EDT', () => {
      // 01:00 UTC on Sep 21 is 9:00 PM on Sep 20 in EDT (UTC-4)
      const date = new Date('2026-09-21T01:00:00.000Z')
      expect(getLocalDateString(date, 'America/New_York')).toBe('2026-09-20')
      expect(getLocalDateString(date, 'UTC')).toBe('2026-09-21')
    })

    it('formats date in America/New_York across midnight boundary in EST', () => {
      // 04:30 UTC on Jan 15 is 11:30 PM on Jan 14 in EST (UTC-5)
      const date = new Date('2026-01-15T04:30:00.000Z')
      expect(getLocalDateString(date, 'America/New_York')).toBe('2026-01-14')
      expect(getLocalDateString(date, 'UTC')).toBe('2026-01-15')
    })
  })

  describe('extractCalendarDate', () => {
    it('extracts date from ISO string without timezone conversion', () => {
      expect(extractCalendarDate('2026-09-21T16:00:00.000Z')).toBe('2026-09-21')
      expect(extractCalendarDate('2026-09-21')).toBe('2026-09-21')
    })

    it('preserves calendar date when Date object is midnight UTC', () => {
      const midnightUtc = new Date('2026-09-21T00:00:00.000Z')
      expect(extractCalendarDate(midnightUtc, 'America/New_York')).toBe('2026-09-21')
    })

    it('converts to local date when Date object has non-zero time', () => {
      const nonMidnight = new Date('2026-09-21T01:00:00.000Z')
      expect(extractCalendarDate(nonMidnight, 'America/New_York')).toBe('2026-09-20')
    })
  })

  describe('getLocalDayOfWeek', () => {
    it('returns day of week in specified timezone', () => {
      // 2026-09-21T01:00:00.000Z is Monday in UTC, but Sunday 9:00 PM in New York
      const date = new Date('2026-09-21T01:00:00.000Z')
      expect(getLocalDayOfWeek(date, 'America/New_York')).toBe(0) // Sunday
      expect(getLocalDayOfWeek(date, 'UTC')).toBe(1) // Monday
    })
  })

  describe('getLocalTimeParts', () => {
    it('extracts 24h and 12h parts in EDT', () => {
      // 16:00 UTC = 12:00 PM EDT
      const date = new Date('2026-09-21T16:00:00.000Z')
      const parts = getLocalTimeParts(date, 'America/New_York')
      expect(parts.hour24).toBe(12)
      expect(parts.minute).toBe(0)
      expect(parts.dayOfWeek).toBe(1) // Monday
      expect(parts.formattedTime).toMatch(/12:00\s*PM/i)
    })

    it('handles midnight 00:00 / 12:00 AM correctly', () => {
      // 04:00 UTC in EDT = 00:00 (12:00 AM)
      const date = new Date('2026-09-21T04:00:00.000Z')
      const parts = getLocalTimeParts(date, 'America/New_York')
      expect(parts.hour24).toBe(0)
      expect(parts.minute).toBe(0)
      expect(parts.formattedTime).toMatch(/12:00\s*AM/i)
    })
  })

  describe('combineDateAndTime', () => {
    it('combines date and time in EDT (UTC-4)', () => {
      // 12:00 EDT = 16:00 UTC
      const result = combineDateAndTime('2026-09-21', '12:00', 'America/New_York')
      expect(result.toISOString()).toBe('2026-09-21T16:00:00.000Z')
    })

    it('combines date and time in EST (UTC-5)', () => {
      // 12:00 EST = 17:00 UTC
      const result = combineDateAndTime('2026-01-15', '12:00', 'America/New_York')
      expect(result.toISOString()).toBe('2026-01-15T17:00:00.000Z')
    })

    it('combines date and time in UTC directly', () => {
      const result = combineDateAndTime('2026-09-21', '12:00', 'UTC')
      expect(result.toISOString()).toBe('2026-09-21T12:00:00.000Z')
    })

    it('supports midnight UTC Date as input', () => {
      const baseDate = new Date('2026-09-21T00:00:00.000Z')
      const result = combineDateAndTime(baseDate, '09:30', 'America/New_York')
      expect(result.toISOString()).toBe('2026-09-21T13:30:00.000Z')
    })
  })
})
