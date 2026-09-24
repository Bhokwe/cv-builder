import { ProfileValidationError } from "../errors.ts";
import { GapAnalysisInputError } from "../scoring/errors.ts";
import { GapAnalysisIntegrityError } from "../scoring/verify.ts";
import { TailoringIntegrityError } from "../tailoring/verify.ts";

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

/**
 * Converts any error this CLI can throw into a single, human-readable
 * message safe to print to a user — never a raw stack trace.
 * GUESS: exact wording is this slice's own choice; the underlying
 * structured errors (from Slices 1-3) are the source of truth.
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof ProfileValidationError) {
    return [
      "Master profile is invalid:",
      ...error.issues.map((issue) => `  - ${issue.message}`),
    ].join("\n");
  }

  if (error instanceof GapAnalysisInputError) {
    return [
      "Cannot score this job description:",
      ...error.issues.map((issue) => `  - ${issue.message}`),
    ].join("\n");
  }

  if (
    error instanceof GapAnalysisIntegrityError ||
    error instanceof TailoringIntegrityError
  ) {
    return `Internal consistency check failed: ${error.message}`;
  }

  if (isNodeErrnoException(error) && error.code === "ENOENT") {
    return `Could not find file: ${error.path ?? "(unknown path)"}`;
  }

  if (error instanceof SyntaxError) {
    return `File is not valid JSON: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}
