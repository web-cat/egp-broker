import { describe, it, expect } from 'vitest'
import {
  assignmentRowSchema,
  createAssignmentSchema,
  updateAssignmentSchema
} from '../../../../shared/models/assignment'

describe('Assignment Shared Schemas', () => {
  it('validates assignmentRowSchema with published true/false', () => {
    const publishedRow = {
      id: 'asg-1',
      resourceLinkId: 'rl-1',
      title: 'Lab 1',
      canvasAssignmentId: '101',
      courseLabel: 'CS101',
      courseTitle: 'Intro to CS',
      dueDate: '2026-08-30T23:59:00.000Z',
      availableFrom: '2026-08-20T00:00:00.000Z',
      acceptUntil: '2026-08-30T23:59:00.000Z',
      published: true,
      createdAt: '2026-08-20T00:00:00.000Z'
    }

    const unpublishedRow = {
      ...publishedRow,
      id: 'asg-2',
      published: false
    }

    expect(assignmentRowSchema.safeParse(publishedRow).success).toBe(true)
    expect(assignmentRowSchema.safeParse(unpublishedRow).success).toBe(true)

    const parsedUnpublished = assignmentRowSchema.parse(unpublishedRow)
    expect(parsedUnpublished.published).toBe(false)
  })

  it('validates createAssignmentSchema and updateAssignmentSchema with published option', () => {
    const createData = {
      courseId: 'course-1',
      title: 'New Assignment',
      published: false
    }
    const updateData = {
      published: true
    }

    expect(createAssignmentSchema.safeParse(createData).success).toBe(true)
    expect(updateAssignmentSchema.safeParse(updateData).success).toBe(true)
  })

  it('validates cbtfDurationMinutes: defaults to 60 in row schema, accepts 30 or 60 in create/update, rejects invalid durations', () => {
    const baseRow = {
      id: 'asg-1',
      resourceLinkId: 'rl-1',
      title: 'Quiz 1',
      canvasAssignmentId: '101',
      courseLabel: 'CS101',
      courseTitle: 'Intro to CS',
      dueDate: '2026-08-30T23:59:00.000Z',
      availableFrom: '2026-08-20T00:00:00.000Z',
      acceptUntil: '2026-08-30T23:59:00.000Z',
      published: true,
      createdAt: '2026-08-20T00:00:00.000Z'
    }

    // Default duration in row schema is 60
    const parsedDefault = assignmentRowSchema.parse(baseRow)
    expect(parsedDefault.cbtfDurationMinutes).toBe(60)

    // Explicit duration 30 in row schema
    const parsed30 = assignmentRowSchema.parse({ ...baseRow, cbtfDurationMinutes: 30 })
    expect(parsed30.cbtfDurationMinutes).toBe(30)

    // createAssignmentSchema accepts 30 and 60
    expect(
      createAssignmentSchema.safeParse({
        courseId: 'c-1',
        title: 'Quiz',
        cbtfDurationMinutes: 30
      }).success
    ).toBe(true)
    expect(
      createAssignmentSchema.safeParse({
        courseId: 'c-1',
        title: 'Exam',
        cbtfDurationMinutes: 60
      }).success
    ).toBe(true)

    // createAssignmentSchema rejects invalid duration
    expect(
      createAssignmentSchema.safeParse({
        courseId: 'c-1',
        title: 'Invalid',
        cbtfDurationMinutes: 45
      }).success
    ).toBe(false)

    // updateAssignmentSchema accepts 30 and 60, rejects 15
    expect(updateAssignmentSchema.safeParse({ cbtfDurationMinutes: 30 }).success).toBe(true)
    expect(updateAssignmentSchema.safeParse({ cbtfDurationMinutes: 60 }).success).toBe(true)
    expect(updateAssignmentSchema.safeParse({ cbtfDurationMinutes: 15 }).success).toBe(false)
  })
})
