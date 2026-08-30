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
  return errors.map((err) => {
    // Ajv reports "required" errors on the parent object's instancePath
    // (e.g. "/roles/0") with the missing key in err.params.missingProperty,
    // not in instancePath itself. Append it so `path` always points at the
    // actual offending field, matching the ValidationIssue.path contract.
    const path =
      err.keyword === "required"
        ? `${err.instancePath}/${(err.params as { missingProperty: string }).missingProperty}`
        : err.instancePath || "/";
    return {
      path,
      keyword: err.keyword,
      message: `${path} ${err.message ?? "is invalid"}`.trim(),
    };
  });
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
