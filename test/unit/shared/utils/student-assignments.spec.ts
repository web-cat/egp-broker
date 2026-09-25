import { describe, it, expect } from 'vitest'
import { filterStudentAssignments } from '@@/shared/utils/student-assignments'
import type { AssignmentRow } from '@@/shared/models/assignment'

describe('filterStudentAssignments', () => {
  const createAssignment = (overrides: Partial<AssignmentRow> = {}): AssignmentRow => ({
    id: 'assign-1',
    resourceLinkId: 'rl-1',
    title: 'Assignment 1',
    canvasAssignmentId: '101',
    courseLabel: 'CS 101',
    courseTitle: 'Introduction to Computer Science',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    availableFrom: new Date(Date.now() - 86400000).toISOString(),
    acceptUntil: new Date(Date.now() + 172800000).toISOString(),
    published: true,
    isSchedulable: true,
    hasInterviews: false,
    createdAt: new Date().toISOString(),
    eligiblePassTypes: [],
    ...overrides
  })

  it('filters out unpublished assignments', () => {
    const assignments = [
      createAssignment({ id: 'pub', published: true }),
      createAssignment({ id: 'unpub', published: false })
    ]
    const filtered = filterStudentAssignments({ assignments })
    expect(filtered.map((a) => a.id)).toEqual(['pub'])
  })

  it('filters out assignments where availableFrom is in the future', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    const assignments = [
      createAssignment({ id: 'unlocked', availableFrom: '2026-09-24T12:00:00Z' }),
      createAssignment({ id: 'locked', availableFrom: '2026-09-26T12:00:00Z' })
    ]
    const filtered = filterStudentAssignments({ assignments, now })
    expect(filtered.map((a) => a.id)).toEqual(['unlocked'])
  })

  it('filters out assignments that are not schedulable, have no interviews, and have no pass types', () => {
    const assignments = [
      createAssignment({
        id: 'sched',
        isSchedulable: true,
        hasInterviews: false,
        eligiblePassTypes: []
      }),
      createAssignment({
        id: 'interview',
        isSchedulable: false,
        hasInterviews: true,
        eligiblePassTypes: []
      }),
      createAssignment({
        id: 'pass',
        isSchedulable: false,
        hasInterviews: false,
        eligiblePassTypes: [{ id: 'pt-1', name: 'Late Pass' }]
      }),
      createAssignment({
        id: 'plain',
        isSchedulable: false,
        hasInterviews: false,
        eligiblePassTypes: []
      })
    ]
    const filtered = filterStudentAssignments({ assignments })
    expect(filtered.map((a) => a.id)).toEqual(['sched', 'interview', 'pass'])
  })

  it('keeps assignments visible if student has an active CBTF reservation even if past deadline', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    const assignments = [
      createAssignment({
        id: 'past-with-cbtf',
        dueDate: '2026-09-20T12:00:00Z',
        acceptUntil: '2026-09-21T12:00:00Z',
        isSchedulable: true,
        eligiblePassTypes: []
      })
    ]
    const getCbtfReservation = (id: string) => {
      if (id === 'past-with-cbtf') {
        return { status: 'SCHEDULED', endTime: '2026-09-25T15:00:00Z' }
      }
      return null
    }

    const filtered = filterStudentAssignments({ assignments, getCbtfReservation, now })
    expect(filtered.map((a) => a.id)).toEqual(['past-with-cbtf'])
  })

  it('keeps assignments visible if student has an active GTA reservation even if past deadline', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    const assignments = [
      createAssignment({
        id: 'past-with-gta',
        dueDate: '2026-09-20T12:00:00Z',
        acceptUntil: '2026-09-21T12:00:00Z',
        hasInterviews: true,
        eligiblePassTypes: []
      })
    ]
    const getGtaReservation = (id: string) => {
      if (id === 'past-with-gta') {
        return { status: 'SCHEDULED', endTime: '2026-09-25T14:00:00Z' }
      }
      return null
    }

    const filtered = filterStudentAssignments({ assignments, getGtaReservation, now })
    expect(filtered.map((a) => a.id)).toEqual(['past-with-gta'])
  })

  it('keeps assignments visible if an active pass extension is in progress', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    const assignments = [
      createAssignment({
        id: 'past-with-ext',
        title: 'Project 1',
        dueDate: '2026-09-20T12:00:00Z',
        acceptUntil: '2026-09-21T12:00:00Z',
        isSchedulable: false,
        eligiblePassTypes: [{ id: 'pt-1', name: 'Late Pass', maxDaysPastDue: 1 }]
      })
    ]
    const redemptions = [
      {
        assignmentId: 'past-with-ext',
        assignmentTitle: 'Project 1',
        dueDate: '2026-09-27T12:00:00Z',
        acceptUntil: '2026-09-28T12:00:00Z'
      }
    ]

    const filtered = filterStudentAssignments({ assignments, redemptions, now })
    expect(filtered.map((a) => a.id)).toEqual(['past-with-ext'])
  })

  it('sorts assignments chronologically by dueDate with nulls last', () => {
    const assignments = [
      createAssignment({ id: 'due-late', dueDate: '2026-10-15T00:00:00Z' }),
      createAssignment({ id: 'no-due', dueDate: null, title: 'Z Assignment' }),
      createAssignment({ id: 'due-early', dueDate: '2026-09-30T00:00:00Z' }),
      createAssignment({ id: 'no-due-a', dueDate: null, title: 'A Assignment' })
    ]
    const filtered = filterStudentAssignments({ assignments })
    expect(filtered.map((a) => a.id)).toEqual(['due-early', 'due-late', 'no-due-a', 'no-due'])
  })
})
