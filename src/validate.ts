import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv, type ErrorObject } from "ajv";
import { ProfileValidationError, type ValidationIssue } from "./errors.ts";
import type { MasterProfile } from "./types.ts";

const schemaPath = fileURLToPath(
  new URL("../schema/profile.schema.json", import.meta.url),
);
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: true });
const validateFn = ajv.compile(schema);

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) return [];
  return errors.map((err) => ({
    path: err.instancePath || "/",
    keyword: err.keyword,
    message: `${err.instancePath || "(root)"} ${err.message ?? "is invalid"}`.trim(),
  }));
}

/**
 * Validates unknown data against the master profile schema.
 * Throws ProfileValidationError (with all issues, not just the first) on failure.
 * Returns the same data, narrowed to MasterProfile, on success.
 */
export function validateProfile(data: unknown): MasterProfile {
  const valid = validateFn(data);
  if (!valid) {
    throw new ProfileValidationError(toIssues(validateFn.errors));
  }
  return data as MasterProfile;
}
