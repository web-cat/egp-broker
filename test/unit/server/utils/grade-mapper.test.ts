import { describe, it, expect } from 'vitest'
import { applyGradeTranslation } from '@@/server/utils/grade-mapper'

describe('applyGradeTranslation', () => {
  it('returns rawScore when mapping is missing or has no type', () => {
    expect(applyGradeTranslation(85, null)).toBe(85)
    expect(applyGradeTranslation(85, {})).toBe(85)
  })

  it('translates categorical / mastery thresholds correctly', () => {
    const mapping = {
      type: 'CATEGORICAL',
      levels: [
        { threshold: 90, value: 100 },
        { threshold: 80, value: 85 },
        { threshold: 70, value: 75 }
      ]
    }
    expect(applyGradeTranslation(95, mapping)).toBe(100)
    expect(applyGradeTranslation(82, mapping)).toBe(85)
    expect(applyGradeTranslation(70, mapping)).toBe(75)
    expect(applyGradeTranslation(50, mapping)).toBe(0)
  })

  it('translates pass / fail mapping correctly', () => {
    const mapping = {
      type: 'PASS_FAIL',
      threshold: 75,
      maxScore: 100
    }
    expect(applyGradeTranslation(80, mapping)).toBe(100)
    expect(applyGradeTranslation(74.9, mapping)).toBe(0)
  })
})
