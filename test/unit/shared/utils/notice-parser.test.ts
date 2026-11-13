import { describe, it, expect } from 'vitest'
import {
  parseNoticesInput,
  parseCsvTable,
  detectStudentIdentifierColumn,
  detectNoticeColumn,
  extractNoticesFromTable
} from '@@/shared/utils/notice-parser'

describe('shared/utils/notice-parser', () => {
  describe('parseNoticesInput', () => {
    it('returns empty array for empty, whitespace, or invalid text', () => {
      expect(parseNoticesInput('')).toEqual([])
      expect(parseNoticesInput('   \n  \n')).toEqual([])
    })

    describe('CSV parsing', () => {
      it('parses standard comma-separated lines', () => {
        const csv =
          'alice@illinois.edu,Review problem 1 edge cases\nbob@illinois.edu,Check memory leaks'
        const parsed = parseNoticesInput(csv)
        expect(parsed).toEqual([
          { studentIdentifier: 'alice@illinois.edu', notice: 'Review problem 1 edge cases' },
          { studentIdentifier: 'bob@illinois.edu', notice: 'Check memory leaks' }
        ])
      })

      it('ignores CSV header row if present', () => {
        const csv =
          'studentIdentifier,notice\nalice@illinois.edu,Review problem 1\nEmail,Notice\nbob@illinois.edu,Check leaks'
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

  describe('parseCsvTable', () => {
    it('parses multi-column CSV into headers and rows', () => {
      const csv =
        'Student,SIS User ID,Section,Score,Notes\nAlice,U12345,001,95,Discuss recursion\nBob,U67890,002,80,'
      const table = parseCsvTable(csv)
      expect(table.headers).toEqual(['Student', 'SIS User ID', 'Section', 'Score', 'Notes'])
      expect(table.rows).toHaveLength(2)
      expect(table.rows[0]).toEqual(['Alice', 'U12345', '001', '95', 'Discuss recursion'])
      expect(table.rows[1]).toEqual(['Bob', 'U67890', '002', '80', ''])
    })

    it('handles tab-separated tables with quotes', () => {
      const tsv =
        'Email\tInterview Questions\tScore\nalice@vt.edu\t"How does O(log n) search work?"\t10'
      const table = parseCsvTable(tsv)
      expect(table.headers).toEqual(['Email', 'Interview Questions', 'Score'])
      expect(table.rows).toHaveLength(1)
      expect(table.rows[0][1]).toBe('How does O(log n) search work?')
    })

    it('returns empty headers and rows on empty input', () => {
      expect(parseCsvTable('')).toEqual({ headers: [], rows: [] })
    })
  })

  describe('detectStudentIdentifierColumn', () => {
    it('identifies student columns across email, netid, student id, sis login id', () => {
      expect(detectStudentIdentifierColumn(['Score', 'Email', 'Notes'])).toBe(1)
      expect(detectStudentIdentifierColumn(['Section', 'SIS User ID', 'Notice'])).toBe(1)
      expect(detectStudentIdentifierColumn(['Name', 'NetID', 'Question'])).toBe(1)
      expect(detectStudentIdentifierColumn(['Student ID', 'Comments'])).toBe(0)
      expect(detectStudentIdentifierColumn(['SIS Login ID', 'Feedback'])).toBe(0)
      expect(detectStudentIdentifierColumn(['Students', 'Notes'])).toBe(0)
    })

    it('defaults to column 0 if no recognizable identifier header found', () => {
      expect(detectStudentIdentifierColumn(['Col A', 'Col B'])).toBe(0)
    })
  })

  describe('detectNoticeColumn', () => {
    it('detects staff notice column patterns including singular and plural forms', () => {
      expect(detectNoticeColumn(['Email', 'Staff Notice'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Staff Notices'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Notice'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Notices'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Comment'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Comments'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Feedback'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Feedbacks'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Note'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Notes'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Message'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Messages'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Remark'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Remarks'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Review'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Reviews'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Flag'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Flags'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Description'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Descriptions'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Issue'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Issues'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Question'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Questions'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Interview Question'])).toBe(1)
      expect(detectNoticeColumn(['Email', 'Interview Questions'])).toBe(1)
    })

    it('defaults to column 1 if second column exists, or column 0 otherwise', () => {
      expect(detectNoticeColumn(['Student', 'Unknown Header'])).toBe(1)
      expect(detectNoticeColumn(['SingleColumn'])).toBe(0)
    })
  })

  describe('extractNoticesFromTable', () => {
    it('extracts notices for specified column indices and ignores empty/sentinel rows', () => {
      const table = {
        headers: ['Student', 'Email', 'Section', 'Interview Questions'],
        rows: [
          ['Alice', 'alice@vt.edu', '001', 'Explain binary search complexity'],
          ['Bob', 'bob@vt.edu', '002', ''],
          ['Carol', 'carol@vt.edu', '001', '   '],
          ['Dan', 'dan@vt.edu', '002', 'N/A'],
          ['Eve', 'eve@vt.edu', '001', 'Check memory allocation in task 3'],
          ['Frank', '', '002', 'Ignored because email empty'],
          ['Grace', 'grace@vt.edu', '001', 'None']
        ]
      }

      const notices = extractNoticesFromTable(table, 1, 3)
      expect(notices).toEqual([
        {
          studentIdentifier: 'alice@vt.edu',
          notice: 'Explain binary search complexity'
        },
        {
          studentIdentifier: 'eve@vt.edu',
          notice: 'Check memory allocation in task 3'
        }
      ])
    })
  })
})
