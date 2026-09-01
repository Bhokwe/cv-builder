/**
 * A single structured problem with the gap-analysis input.
 * Mirrors the shape of Slice 1's ValidationIssue (path/keyword/message) for
 * consistency, but is defined independently so this slice never has to edit
 * Slice 1's src/errors.ts.
 */
export interface GapAnalysisIssue {
  /** Name of the offending input, e.g. "jobDescriptionText". */
  path: string;
  /** Machine-readable reason, e.g. "required". */
  keyword: string;
  /** Human-readable explanation. */
  message: string;
}

/**
 * Thrown when runGapAnalysis is called with input that cannot be scored at
 * all (currently: a missing/empty job description). This is a halt, not a
 * gap score of 0 — a missing JD is an input error, not a mismatch.
 */
export class GapAnalysisInputError extends Error {
  public readonly issues: GapAnalysisIssue[];

  constructor(issues: GapAnalysisIssue[]) {
    const summary =
      issues.length === 1
        ? issues[0]!.message
        : `${issues.length} input errors: ${issues.map((i) => i.message).join("; ")}`;
    super(summary);
    this.name = "GapAnalysisInputError";
    this.issues = issues;
  }
}
