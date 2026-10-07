import { describe, it, expect } from 'vitest'
import {
  isAssignmentExpired,
  filterTeacherAssignments,
  DEFAULT_ASSIGNMENT_FILTERS
} from '@@/shared/utils/assignment-filters'
import type { AssignmentRow } from '@@/shared/models/assignment'

describe('assignment-filters', () => {
  const createAssignment = (overrides: Partial<AssignmentRow> = {}): AssignmentRow => ({
    id: 'assign-1',
    resourceLinkId: 'rl-1',
    title: 'Assignment 1',
    canvasAssignmentId: '101',
    courseLabel: 'CS 101',
    dueDate: '2026-10-15T00:00:00Z',
    availableFrom: '2026-10-01T00:00:00Z',
    acceptUntil: '2026-10-20T00:00:00Z',
    published: true,
    isSchedulable: false,
    hasInterviews: false,
    createdAt: '2026-10-01T00:00:00Z',
    eligiblePassTypes: [],
    ...overrides
  })

  describe('isAssignmentExpired', () => {
    const now = new Date('2026-10-05T12:00:00Z')

    it('returns true when acceptUntil is in the past', () => {
      const a = createAssignment({
        acceptUntil: '2026-10-04T00:00:00Z',
        dueDate: '2026-10-03T00:00:00Z'
      })
      expect(isAssignmentExpired(a, now)).toBe(true)
    })

    it('returns false when acceptUntil is in the future even if dueDate is past', () => {
      const a = createAssignment({
        acceptUntil: '2026-10-10T00:00:00Z',
        dueDate: '2026-10-04T00:00:00Z'
      })
      expect(isAssignmentExpired(a, now)).toBe(false)
    })

    it('falls back to scheduleWindowEnd if acceptUntil is null', () => {
      const a = createAssignment({
        acceptUntil: null,
        scheduleWindowEnd: '2026-10-04T00:00:00Z',
        dueDate: '2026-10-10T00:00:00Z'
      })
      expect(isAssignmentExpired(a, now)).toBe(true)
    })

    it('falls back to interviewWindowEnd if acceptUntil is null', () => {
      const a = createAssignment({
        acceptUntil: null,
        interviewWindowEnd: '2026-10-04T00:00:00Z',
        dueDate: '2026-10-10T00:00:00Z'
      })
      expect(isAssignmentExpired(a, now)).toBe(true)
    })

    it('falls back to dueDate when acceptUntil is not set', () => {
      const a = createAssignment({
        acceptUntil: null,
        dueDate: '2026-10-04T00:00:00Z'
      })
      expect(isAssignmentExpired(a, now)).toBe(true)

      const b = createAssignment({
        acceptUntil: null,
        dueDate: '2026-10-10T00:00:00Z'
      })
      expect(isAssignmentExpired(b, now)).toBe(false)
    })

    it('returns false when no cutoff or due dates are set', () => {
      const a = createAssignment({
        acceptUntil: null,
        dueDate: null
      })
      expect(isAssignmentExpired(a, now)).toBe(false)
    })
  })

  describe('filterTeacherAssignments', () => {
    const now = new Date('2026-10-05T12:00:00Z')

    const assignments = [
      createAssignment({
        id: 'pub-active-standard',
        published: true,
        acceptUntil: '2026-10-20T00:00:00Z',
        isSchedulable: false,
        hasInterviews: false
      }),
      createAssignment({
        id: 'unpub-active-standard',
        published: false,
        acceptUntil: '2026-10-20T00:00:00Z',
        isSchedulable: false,
        hasInterviews: false
      }),
      createAssignment({
        id: 'pub-expired-standard',
        published: true,
        acceptUntil: '2026-10-01T00:00:00Z',
        isSchedulable: false,
        hasInterviews: false
      }),
      createAssignment({
        id: 'pub-active-cbtf',
        published: true,
        acceptUntil: '2026-10-20T00:00:00Z',
        isSchedulable: true,
        hasInterviews: false
      }),
      createAssignment({
        id: 'pub-active-gta',
        published: true,
        acceptUntil: '2026-10-20T00:00:00Z',
        isSchedulable: false,
        hasInterviews: true
      })
    ]

    it('shows all assignments by default (no filters applied)', () => {
      const result = filterTeacherAssignments(assignments, DEFAULT_ASSIGNMENT_FILTERS, now)
      expect(result.map((a) => a.id)).toEqual([
        'pub-active-standard',
        'unpub-active-standard',
        'pub-expired-standard',
        'pub-active-cbtf',
        'pub-active-gta'
      ])
    })

    it('omits unpublished assignments when unpublished is false', () => {
      const result = filterTeacherAssignments(
        assignments,
        { ...DEFAULT_ASSIGNMENT_FILTERS, unpublished: false },
        now
      )
      expect(result.map((a) => a.id)).toEqual([
        'pub-active-standard',
        'pub-expired-standard',
        'pub-active-cbtf',
        'pub-active-gta'
      ])
    })

    it('omits expired assignments when expired is false', () => {
      const result = filterTeacherAssignments(
        assignments,
        { ...DEFAULT_ASSIGNMENT_FILTERS, expired: false },
        now
      )
      expect(result.map((a) => a.id)).toEqual([
        'pub-active-standard',
        'unpub-active-standard',
        'pub-active-cbtf',
        'pub-active-gta'
      ])
    })

    it('omits published assignments when published is false', () => {
      const result = filterTeacherAssignments(
        assignments,
        { ...DEFAULT_ASSIGNMENT_FILTERS, published: false },
        now
      )
      expect(result.map((a) => a.id)).toEqual(['unpub-active-standard'])
    })

    it('omits active assignments when active is false', () => {
      const result = filterTeacherAssignments(
        assignments,
        { ...DEFAULT_ASSIGNMENT_FILTERS, active: false },
        now
      )
      expect(result.map((a) => a.id)).toEqual(['pub-expired-standard'])
    })

    it('filters strictly by modality (e.g. CBTF only)', () => {
      const result = filterTeacherAssignments(
        assignments,
        {
          ...DEFAULT_ASSIGNMENT_FILTERS,
          cbtf: true,
          interviews: false,
          standard: false
        },
        now
      )
      expect(result.map((a) => a.id)).toEqual(['pub-active-cbtf'])
    })

    it('filters strictly by modality (e.g. GTA interviews only)', () => {
      const result = filterTeacherAssignments(
        assignments,
        {
          ...DEFAULT_ASSIGNMENT_FILTERS,
          cbtf: false,
          interviews: true,
          standard: false
        },
        now
      )
      expect(result.map((a) => a.id)).toEqual(['pub-active-gta'])
    })

    it('omits CBTF exams when cbtf is false', () => {
      const result = filterTeacherAssignments(
        assignments,
        {
          ...DEFAULT_ASSIGNMENT_FILTERS,
          cbtf: false
        },
        now
      )
      expect(result.map((a) => a.id)).not.toContain('pub-active-cbtf')
      expect(result).toHaveLength(4)
    })

    it('shows everything when all flags are enabled', () => {
      const result = filterTeacherAssignments(
        assignments,
        {
          published: true,
          unpublished: true,
          active: true,
          expired: true,
          cbtf: true,
          interviews: true,
          standard: true
        },
        now
      )
      expect(result).toHaveLength(5)
    })
  })
})
