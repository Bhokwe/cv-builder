/**
 * GUESS / NOT WIRED UP.
 *
 * The slice plan lists an "LLM prompt" as part of what this slice adds. This
 * file provides that artifact as a template only. It is NOT called anywhere
 * in this slice — runGapAnalysis (pipeline.ts) is fully deterministic and
 * offline, which is what lets this slice's verify list run without network
 * access, an API key, or non-deterministic output.
 *
 * If a future slice wires this to a real LLM call, treat this as a starting
 * point, not a finished contract: response parsing, retries, and rubric
 * enforcement against the LLM's output would still need to reuse
 * verify.ts's checks before anything from this prompt is trusted.
 */
import type { MasterProfile } from "../types.ts";

export function buildDiagnosticPrompt(
  profile: MasterProfile,
  jobDescriptionText: string,
): string {
  return [
    "You are an honest, conservative ATS/recruiter assistant.",
    "Given a candidate's verified master profile (JSON) and a job description,",
    "produce a gap score from 0 (no match) to 3 (strong match), a list of",
    "overlapping strengths, a list of missing mandatory criteria, and a",
    "keyword match breakdown.",
    "",
    "Rules:",
    "- Only reference skills, roles, and achievements that literally appear",
    "  in the master profile. Never invent or infer credentials, skills, or",
    "  metrics that are not present verbatim in the master profile.",
    "- Only reference requirements that literally appear in the job",
    "  description text.",
    "- If you are unsure whether something is a match, treat it as not a",
    "  match (bias toward an honest, lower score).",
    "",
    "Master profile (JSON):",
    JSON.stringify(profile, null, 2),
    "",
    "Job description:",
    jobDescriptionText,
  ].join("\n");
}
