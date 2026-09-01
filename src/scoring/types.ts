/**
 * Slice 2: ATS Scoring & Gap-Analysis Pipeline.
 *
 * These types describe the output of runGapAnalysis (see pipeline.ts).
 * GUESS: the exact field set is a minimal interpretation of the slice's
 * "what I add" description (gap score, missing required skills, keyword
 * match breakdown, ATS format red flags) — no other fields are implied.
 */

/** A single ATS formatting concern found in the master profile's text. */
export interface AtsFormatFlag {
  /** id of the Achievement the flag was raised against. */
  achievementId: string;
  /** Human-readable, fixed-template reason (never generated/free text). */
  reason: string;
}

export interface KeywordMatchBreakdown {
  /** Number of mandatory requirement lines detected in the job description. */
  totalRequirements: number;
  /** Number of those requirement lines covered by the master profile. */
  metRequirementsCount: number;
}

export interface GapAnalysisReport {
  /** Honest gap score, 0 (no match) to 3 (strong match). */
  score: 0 | 1 | 2 | 3;
  /**
   * Master-profile skill names found in the job description text.
   * Every entry is a verbatim copy of a MasterProfile.skills[].name value
   * (never invented) — see verify.ts#verifyNoFabrication.
   */
  overlappingStrengths: string[];
  /**
   * Mandatory requirement lines from the job description that the master
   * profile does not cover. Every entry is a verbatim excerpt of the
   * original job description text (never invented).
   */
  missingMandatoryCriteria: string[];
  keywordMatchBreakdown: KeywordMatchBreakdown;
  atsFormatFlags: AtsFormatFlag[];
}
