import { describe, it, expect } from 'vitest'
import { parseNoticesInput } from '@@/shared/utils/notice-parser'

describe('shared/utils/notice-parser: parseNoticesInput', () => {
  it('returns empty array for empty, whitespace, or invalid text', () => {
    expect(parseNoticesInput('')).toEqual([])
    expect(parseNoticesInput('   \n  \n')).toEqual([])
  })

  describe('CSV parsing', () => {
    it('parses standard comma-separated lines', () => {
      const csv = 'alice@illinois.edu,Review problem 1 edge cases\nbob@illinois.edu,Check memory leaks'
      const parsed = parseNoticesInput(csv)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Review problem 1 edge cases' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Check memory leaks' }
      ])
    })

    it('ignores CSV header row if present', () => {
      const csv = 'studentIdentifier,notice\nalice@illinois.edu,Review problem 1\nEmail,Notice\nbob@illinois.edu,Check leaks'
      const parsed = parseNoticesInput(csv)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Review problem 1' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Check leaks' }
      ])
    })

    it('handles quoted fields with commas and whitespace', () => {
      const csv = '"alice@illinois.edu", "Review problem 1, 2, and 3"\n"67890", "Special comment"'
      const parsed = parseNoticesInput(csv)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Review problem 1, 2, and 3' },
        { studentIdentifier: '67890', notice: 'Special comment' }
      ])
    })
  })

  describe('TSV parsing', () => {
    it('parses tab-separated values', () => {
      const tsv = 'alice@illinois.edu\tReview edge cases\nbob@illinois.edu\tCheck leaks'
      const parsed = parseNoticesInput(tsv)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Review edge cases' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Check leaks' }
      ])
    })
  })

  describe('JSON parsing', () => {
    it('parses array of objects with studentIdentifier and notice', () => {
      const json = JSON.stringify([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Good work' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Check edge cases' }
      ])
      const parsed = parseNoticesInput(json)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Good work' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Check edge cases' }
      ])
    })

    it('supports alias fields in JSON objects (email, studentId, message)', () => {
      const json = JSON.stringify([
        { email: 'alice@illinois.edu', message: 'Good work' },
        { studentId: 'U12345678', notice: 'Check edge cases' }
      ])
      const parsed = parseNoticesInput(json)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Good work' },
        { studentIdentifier: 'U12345678', notice: 'Check edge cases' }
      ])
    })

    it('supports JSON key-value dictionary map', () => {
      const json = JSON.stringify({
        'alice@illinois.edu': 'Great explanation',
        'bob@illinois.edu': 'Needs deeper proof'
      })
      const parsed = parseNoticesInput(json)
      expect(parsed).toEqual([
        { studentIdentifier: 'alice@illinois.edu', notice: 'Great explanation' },
        { studentIdentifier: 'bob@illinois.edu', notice: 'Needs deeper proof' }
      ])
    })
  })
})
