import { describe, it, expect } from 'vitest'
import {
  courseSectionSchema,
  assignmentOverrideSchema,
  effectiveAssignmentDatesSchema
} from '@@/shared/models/override'

describe('Override & Section Schemas', () => {
  it('validates a valid courseSectionSchema', () => {
    const validSection = {
      id: 'cs1',
      courseId: 'c1',
      canvasSectionId: '12345',
      name: 'Section 001'
    }
    const parsed = courseSectionSchema.safeParse(validSection)
    expect(parsed.success).toBe(true)
  })

  it('validates a valid assignmentOverrideSchema', () => {
    const validOverride = {
      id: 'ao1',
      assignmentId: 'a1',
      canvasOverrideId: '987',
      title: 'Section 001 Override',
      dueDate: '2026-05-22T23:59:00.000Z',
      courseSectionId: 'cs1'
    }
    const parsed = assignmentOverrideSchema.safeParse(validOverride)
    expect(parsed.success).toBe(true)
  })

  it('validates effectiveAssignmentDatesSchema', () => {
    const dates = {
      availableFrom: new Date(),
      dueDate: new Date(),
      acceptUntil: null,
      overrideType: 'SECTION' as const,
      overrideTitle: 'Section 001'
    }
    const parsed = effectiveAssignmentDatesSchema.safeParse(dates)
    expect(parsed.success).toBe(true)
  })
})
