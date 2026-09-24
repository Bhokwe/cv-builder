import type { GapAnalysisReport } from "../scoring/types.ts";

/**
 * Renders a GapAnalysisReport as human-readable plain text for the CLI.
 * GUESS: exact wording/layout is this slice's own choice; the report's own
 * fields (from Slice 2) are the source of truth, this only formats them.
 */
export function formatGapAnalysisReport(report: GapAnalysisReport): string {
  const lines: string[] = [];

  lines.push(`Gap score: ${report.score} / 3`);
  lines.push(
    `Requirements met: ${report.keywordMatchBreakdown.metRequirementsCount} / ${report.keywordMatchBreakdown.totalRequirements}`,
  );

  lines.push("");
  lines.push("Overlapping strengths:");
  if (report.overlappingStrengths.length === 0) {
    lines.push("  (none found)");
  } else {
    for (const strength of report.overlappingStrengths) {
      lines.push(`  - ${strength}`);
    }
  }

  lines.push("");
  lines.push("Missing mandatory criteria:");
  if (report.missingMandatoryCriteria.length === 0) {
    lines.push("  (none)");
  } else {
    for (const criterion of report.missingMandatoryCriteria) {
      lines.push(`  - ${criterion}`);
    }
  }

  lines.push("");
  lines.push("ATS format flags:");
  if (report.atsFormatFlags.length === 0) {
    lines.push("  (none)");
  } else {
    for (const flag of report.atsFormatFlags) {
      lines.push(`  - [${flag.achievementId}] ${flag.reason}`);
    }
  }

  return lines.join("\n");
}
