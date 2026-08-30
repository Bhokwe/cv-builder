/**
 * A single structured validation problem, one per failing schema rule.
 */
export interface ValidationIssue {
  /**
   * JSON path to the offending field, e.g. "/roles/0/title". Points at the
   * field itself even when the failure is a missing required property
   * (rather than at the parent object that is missing it).
   */
  path: string;
  /** Machine-readable reason, e.g. "required", "minLength", "pattern". */
  keyword: string;
  /** Human-readable explanation. */
  message: string;
}

/**
 * Thrown when profile data does not conform to schema/profile.schema.json.
 * Carries the full list of issues instead of failing on the first one.
 */
export class ProfileValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const summary =
      issues.length === 1
        ? issues[0]!.message
        : `${issues.length} validation errors: ${issues.map((i) => i.message).join("; ")}`;
    super(summary);
    this.name = "ProfileValidationError";
    this.issues = issues;
  }
}
