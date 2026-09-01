/**
 * "Deterministic verification logic to ensure scores adhere to rubric and
 * no credentials are fabricated" (per the slice plan). These checks re-derive
 * the report's guarantees from its own inputs and throw if either is
 * violated. They run inside runGapAnalysis on every call (see pipeline.ts),
 * not just in tests.
 */
import type { MasterProfile } from "../types.ts";
import { computeScore } from "./rubric.ts";
import type { GapAnalysisReport } from "./types.ts";

/**
 * Thrown only if the pipeline's own internal invariants are violated
 * (should be unreachable in normal operation — this is a safety net, not a
 * user-facing input error).
 */
export class GapAnalysisIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GapAnalysisIntegrityError";
  }
}

/**
 * Confirms every fact in the report is a verbatim copy of either (a) a
 * MasterProfile skill name, or (b) an excerpt of the original job
 * description text — never a generated/invented string.
 */
export function verifyNoFabrication(
  report: GapAnalysisReport,
  profile: MasterProfile,
  jobDescriptionText: string,
): void {
  const knownSkillNames = new Set(profile.skills.map((skill) => skill.name));

  for (const strength of report.overlappingStrengths) {
    if (!knownSkillNames.has(strength)) {
      throw new GapAnalysisIntegrityError(
        `Fabrication check failed: overlapping strength "${strength}" is not a verbatim skill name from the master profile.`,
      );
    }
  }

  for (const criterion of report.missingMandatoryCriteria) {
    if (!jobDescriptionText.includes(criterion)) {
      throw new GapAnalysisIntegrityError(
        `Fabrication check failed: missing-criterion "${criterion}" is not a verbatim excerpt from the job description.`,
      );
    }
  }
}

/** Confirms report.score is exactly what the rubric would compute from the report's own breakdown. */
export function verifyScoreMatchesRubric(report: GapAnalysisReport): void {
  const expectedScore = computeScore({
    totalRequirements: report.keywordMatchBreakdown.totalRequirements,
    metRequirementsCount: report.keywordMatchBreakdown.metRequirementsCount,
    overlappingStrengthsCount: report.overlappingStrengths.length,
  });

  if (expectedScore !== report.score) {
    throw new GapAnalysisIntegrityError(
      `Rubric check failed: report.score is ${report.score} but the rubric computes ${expectedScore} from its own keywordMatchBreakdown.`,
    );
  }
}
