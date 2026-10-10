import { describe, it, expect } from 'vitest'
import { formatDate, formatTime } from '@@/app/utils/date'

describe('Date Utils - Simple Tests', () => {
  describe('Date conversion', () => {
    it('should create valid Date from string', () => {
      const date = new Date('2024-01-15')
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(0) // Janvier = 0
      expect(date.getUTCDate()).toBe(15)
    })

    it('should detect invalid dates', () => {
      const invalidDate = new Date('invalid-date')
      expect(isNaN(invalidDate.getTime())).toBe(true)
    })

    it('should format dates with toLocaleDateString', () => {
      const date = new Date('2024-01-15')
      const formatted = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })

      expect(formatted).toContain('2024')
    })

    it('formats date string locked to America/New_York timezone', () => {
      // 01:00 UTC on Sep 21 = 9:00 PM on Sep 20 in EDT
      const formatted = formatDate('2026-09-21T01:00:00.000Z', 'en-US')
      expect(formatted).toContain('Sep 20, 2026')
      expect(formatted).toMatch(/9:00\s*PM/i)
    })

    it('formats time string locked to America/New_York timezone', () => {
      // 16:30 UTC on Sep 21 = 12:30 EDT
      const formatted = formatTime('2026-09-21T16:30:00.000Z', 'en-US')
      expect(formatted).toMatch(/12:30/i)
    })

    it('returns empty string for null, undefined, or invalid dates', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined as any)).toBe('')
      expect(formatDate('invalid')).toBe('')
      expect(formatTime('')).toBe('')
    })
  })
})
