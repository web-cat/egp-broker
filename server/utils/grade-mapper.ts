// server/utils/grade-mapper.ts
export function applyGradeTranslation(rawScore: number, mapping: any) {
  if (!mapping || !mapping.type) return rawScore; // Pass-through

  // Strategy 1: Categorical / Mastery Remapping
  if (mapping.type === 'CATEGORICAL') {
    const levels = mapping.levels || [];
    // Sort descending to find the highest threshold the student met
    const sortedLevels = [...levels].sort((a, b) => Number(b.threshold) - Number(a.threshold));
    
    for (const level of sortedLevels) {
      if (rawScore >= Number(level.threshold)) {
        // Return the remapped value
        return Number(level.value);
      }
    }
    return 0; // Default if no threshold met
  }

  // Strategy 2: Pass / Fail
  if (mapping.type === 'PASS_FAIL') {
    return rawScore >= Number(mapping.threshold) ? mapping.maxScore : 0.0;
  }

  return rawScore;
}
