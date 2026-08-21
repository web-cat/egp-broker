import { describe, it, expect } from 'vitest'
import {
  createGradeTranslationSchema,
  updateGradeTranslationSchema,
  gradeTranslationRowSchema
} from '@@/shared/models/grade-translation'

describe('GradeTranslation Schemas', () => {
  it('validates creation payload', () => {
    const valid = {
      name: 'Standard Letter Grades',
      description: 'Converts percentages to letter grades',
      mapping: { type: 'CATEGORICAL', levels: [{ threshold: 90, value: 100 }] }
    }
    const parsed = createGradeTranslationSchema.parse(valid)
    expect(parsed.name).toBe('Standard Letter Grades')
  })

  it('validates partial update payload', () => {
    const valid = {
      name: 'Updated Name'
    }
    const parsed = updateGradeTranslationSchema.parse(valid)
    expect(parsed.name).toBe('Updated Name')
  })

  it('validates row projection schema', () => {
    const valid = {
      id: 'gt123',
      name: 'Standard',
      description: null,
      maxScore: 1.0,
      mapping: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const parsed = gradeTranslationRowSchema.parse(valid)
    expect(parsed.id).toBe('gt123')
    expect(parsed.name).toBe('Standard')
  })
})
