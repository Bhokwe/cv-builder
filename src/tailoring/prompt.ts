/**
 * GUESS / NOT WIRED UP.
 *
 * The slice plan lists a "prompt pipeline" as part of what this slice adds.
 * This file provides that artifact as a template only. It is NOT called
 * anywhere in this slice — tailorCv/runTailoringPipeline (pipeline.ts) are
 * fully deterministic and offline, for the same reason as Slice 2's
 * scoring prompt: it lets this slice's verify list run without network
 * access, an API key, or non-deterministic output.
 *
 * If a future slice wires this to a real LLM call, treat this as a
 * starting point, not a finished contract: response parsing and
 * fact-constraint enforcement against the LLM's output would still need to
 * reuse verify.ts's checks before anything from this prompt is trusted.
 */
import type { MasterProfile } from "../types.ts";
import type { GapAnalysisReport } from "../scoring/types.ts";

export function buildTailoringPrompt(
  profile: MasterProfile,
  gapAnalysisReport: GapAnalysisReport,
): string {
  return [
    "You are a strict, fact-constrained resume tailoring assistant.",
    "Given a candidate's verified master profile (JSON) and a gap-analysis",
    "report from an earlier ATS scoring step, select and reorder the",
    "candidate's existing roles, skills, and achievement bullets to best",
    "match the job description that produced the gap-analysis report.",
    "",
    "Rules:",
    "- Never invent, alter, paraphrase, or combine a bullet, title,",
    "  organization name, date, or metric. Every fact in your output must",
    "  appear verbatim in the master profile.",
    "- You may only reorder and omit; you may never add.",
    "- Prioritize roles, skills, and bullets that overlap with",
    "  gapAnalysisReport.overlappingStrengths.",
    "",
    "Master profile (JSON):",
    JSON.stringify(profile, null, 2),
    "",
    "Gap analysis report (JSON):",
    JSON.stringify(gapAnalysisReport, null, 2),
  ].join("\n");
}
