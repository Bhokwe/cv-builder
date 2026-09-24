/**
 * Composes Slices 1-3: load the master profile (Slice 1), score it against
 * a job description (Slice 2), and optionally tailor+export it (Slice 3).
 * No new business logic lives here — this only wires existing pipelines
 * together and handles file I/O for the CLI.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadProfile } from "../repository.ts";
import type { MasterProfile } from "../types.ts";
import { runGapAnalysis } from "../scoring/pipeline.ts";
import type { GapAnalysisReport } from "../scoring/types.ts";
import { runTailoringPipeline } from "../tailoring/pipeline.ts";
import type { TailoredCv } from "../tailoring/types.ts";
import { formatGapAnalysisReport } from "./formatReport.ts";

export interface DiagnosticWorkflowResult {
  profile: MasterProfile;
  jobDescriptionText: string;
  report: GapAnalysisReport;
  formattedReport: string;
}

/** Load profile + JD, run Slice 2 scoring, and render a human-readable report. */
export async function runDiagnosticWorkflow(
  profilePath: string,
  jobDescriptionPath: string,
): Promise<DiagnosticWorkflowResult> {
  const profile = await loadProfile(profilePath);
  const jobDescriptionText = await readFile(jobDescriptionPath, "utf-8");
  const report = runGapAnalysis(profile, jobDescriptionText);
  const formattedReport = formatGapAnalysisReport(report);
  return { profile, jobDescriptionText, report, formattedReport };
}

export interface TailorWorkflowResult {
  profile: MasterProfile;
  report: GapAnalysisReport;
  tailoredCv: TailoredCv;
  markdown: string;
  /** Set only if `outputPath` was provided and the write succeeded. */
  savedTo?: string;
}

/** Load profile + JD, run Slice 2 scoring, then Slice 3 tailoring, optionally saving the export. */
export async function runTailorWorkflow(
  profilePath: string,
  jobDescriptionPath: string,
  outputPath?: string,
): Promise<TailorWorkflowResult> {
  const profile = await loadProfile(profilePath);
  const jobDescriptionText = await readFile(jobDescriptionPath, "utf-8");
  const report = runGapAnalysis(profile, jobDescriptionText);
  const { tailoredCv, markdown } = runTailoringPipeline(profile, report);

  let savedTo: string | undefined;
  if (outputPath) {
    await writeFile(outputPath, markdown, "utf-8");
    savedTo = outputPath;
  }

  return { profile, report, tailoredCv, markdown, savedTo };
}
