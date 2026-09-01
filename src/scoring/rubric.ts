/**
 * Deterministic 0-3 scoring rubric.
 * GUESS: exact thresholds below are an interpretation of "honest gap score"
 * chosen to satisfy this slice's verify list (matching JD -> >=2, mismatched
 * JD -> 0 or 1). No calibration against real job descriptions was done.
 */
export interface ScoreInput {
  totalRequirements: number;
  metRequirementsCount: number;
  overlappingStrengthsCount: number;
}

export function computeScore(input: ScoreInput): 0 | 1 | 2 | 3 {
  const { totalRequirements, metRequirementsCount, overlappingStrengthsCount } =
    input;

  if (totalRequirements === 0) {
    // GUESS fallback: the job description had no detectable mandatory
    // requirements at all, so fall back to general keyword overlap only.
    return overlappingStrengthsCount > 0 ? 2 : 0;
  }

  const missingCount = totalRequirements - metRequirementsCount;
  const missingRatio = missingCount / totalRequirements;

  if (missingRatio === 0 && overlappingStrengthsCount > 0) return 3;
  if (missingRatio <= 1 / 3 && overlappingStrengthsCount > 0) return 2;
  if (missingRatio < 1) return 1;
  return 0;
}
