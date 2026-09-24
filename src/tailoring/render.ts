/**
 * Renders a TailoredCv to plain-text/Markdown, and a deterministic checker
 * confirming the result is ATS-safe.
 *
 * GUESS: "ATS-safe" here means: headings (#, ##) and hyphen bullets only —
 * no tables, no images, no embedded HTML, no tabs, no multi-column layout
 * markers. There is no rendered resume DOCUMENT yet (that is Slice 4's
 * concern); this only proves the intermediate text structure is clean.
 */
import { TailoringIntegrityError } from "./verify.ts";
import type { TailoredCv } from "./types.ts";

// GUESS: fixed, non-localized wording for an ongoing role.
const PRESENT_LABEL = "Present";

function formatDateRange(startDate: string, endDate: string | null): string {
  return `${startDate} - ${endDate ?? PRESENT_LABEL}`;
}

export function renderTailoredCvToMarkdown(tailoredCv: TailoredCv): string {
  const sections: string[] = ["# Experience"];

  for (const role of tailoredCv.roles) {
    sections.push(`## ${role.title} - ${role.organization}`);
    sections.push(formatDateRange(role.startDate, role.endDate));
    if (role.bullets.length > 0) {
      sections.push(role.bullets.map((bullet) => `- ${bullet}`).join("\n"));
    }
  }

  sections.push("# Skills");
  if (tailoredCv.skills.length > 0) {
    sections.push(tailoredCv.skills.map((skill) => `- ${skill}`).join("\n"));
  }

  return sections.join("\n\n") + "\n";
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<[a-z][^>]*>/i, reason: "contains an HTML tag" },
  { pattern: /!\[.*?\]\(.*?\)/, reason: "contains a Markdown image" },
  { pattern: /^\s*\|.*\|\s*$/m, reason: "contains a Markdown table row" },
  { pattern: /\t/, reason: "contains a tab character" },
];

/** Throws TailoringIntegrityError if `markdown` contains any known ATS-unsafe construct. */
export function assertAtsSafeMarkdown(markdown: string): void {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(markdown)) {
      throw new TailoringIntegrityError(
        `Rendered CV is not ATS-safe: ${reason}.`,
      );
    }
  }
}
