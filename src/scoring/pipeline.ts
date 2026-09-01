import { validateProfile } from "../validate.ts";
import type { MasterProfile } from "../types.ts";
import { checkAtsFormatFlags } from "./atsFormat.ts";
import { GapAnalysisInputError } from "./errors.ts";
import { computeScore } from "./rubric.ts";
import {
  extractMandatoryRequirementLines,
  findOverlappingSkills,
  isRequirementCovered,
  normalize,
} from "./textMatch.ts";
import type { GapAnalysisReport } from "./types.ts";
import { verifyNoFabrication, verifyScoreMatchesRubric } from "./verify.ts";

/**
 * Runs the diagnostic gap-analysis pipeline for one (MasterProfile, job
 * description) pair. Fully deterministic and offline (see prompt.ts).
 *
 * Throws GapAnalysisInputError if jobDescriptionText is missing/empty.
 * Throws ProfileValidationError (from Slice 1) if `profile` itself is not a
 * valid MasterProfile — reused as-is rather than re-implemented here.
 */
export function runGapAnalysis(
  profile: MasterProfile,
  jobDescriptionText: string | null | undefined,
): GapAnalysisReport {
  if (jobDescriptionText == null || jobDescriptionText.trim().length === 0) {
    throw new GapAnalysisInputError([
      {
        path: "jobDescriptionText",
        keyword: "required",
        message:
          "jobDescriptionText must be a non-empty string; the pipeline cannot score a missing job description.",
      },
    ]);
  }

  // Defense in depth: reuse Slice 1's validator instead of re-checking shape.
  const validatedProfile = validateProfile(profile);

  const jdTextNormalized = normalize(jobDescriptionText);
  const overlappingStrengths = findOverlappingSkills(
    validatedProfile,
    jdTextNormalized,
  );

  const requirementLines = extractMandatoryRequirementLines(jobDescriptionText);
  const missingMandatoryCriteria: string[] = [];
  let metRequirementsCount = 0;

  for (const line of requirementLines) {
    if (isRequirementCovered(normalize(line), validatedProfile)) {
      metRequirementsCount += 1;
    } else {
      missingMandatoryCriteria.push(line);
    }
  }

  const totalRequirements = requirementLines.length;
  const score = computeScore({
    totalRequirements,
    metRequirementsCount,
    overlappingStrengthsCount: overlappingStrengths.length,
  });

  const report: GapAnalysisReport = {
    score,
    overlappingStrengths,
    missingMandatoryCriteria,
    keywordMatchBreakdown: { totalRequirements, metRequirementsCount },
    atsFormatFlags: checkAtsFormatFlags(validatedProfile),
  };

  // Deterministic verification logic required by the slice plan.
  verifyScoreMatchesRubric(report);
  verifyNoFabrication(report, validatedProfile, jobDescriptionText);

  return report;
}
