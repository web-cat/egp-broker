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
})
