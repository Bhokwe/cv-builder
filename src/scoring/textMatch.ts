/**
 * Deterministic, offline text matching between a job description and a
 * MasterProfile. No AI/LLM call is made here (see prompt.ts for why).
 *
 * GUESS: every heuristic in this file (section-header list, bullet-line
 * pattern, fallback rule, phrase-boundary matching) is a simplified stand-in
 * for real NLP. It is deliberately conservative (word-boundary matching, no
 * fuzzy/stemmed matching) so that "overlap found" can never be a false
 * positive caused by a substring collision (e.g. "java" inside
 * "javascript").
 */
import type { MasterProfile } from "../types.ts";

/** Lowercases and strips punctuation except characters used inside real skill names (+, #, .). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True if `phraseNormalized` appears in `haystackNormalized` as a whole,
 * space-delimited phrase (not as a substring of a longer word).
 */
export function containsPhrase(
  haystackNormalized: string,
  phraseNormalized: string,
): boolean {
  if (phraseNormalized.length === 0) return false;
  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(phraseNormalized)}(?:\\s|$)`,
  );
  return pattern.test(haystackNormalized);
}

// GUESS: recognized mandatory-requirement section headers. Anything else
// (e.g. "Nice to have", "Preferred qualifications") is intentionally NOT
// treated as mandatory.
const SECTION_HEADER_RE =
  /^(requirements|required qualifications|minimum qualifications|must have|required skills|qualifications)\s*:?\s*$/i;

const BULLET_LINE_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.*\S)\s*$/;

// GUESS fallback heuristic used only if no recognized section is found at
// all: treat any line containing "required"/"must (have)" as one mandatory
// requirement line.
const FALLBACK_LINE_RE = /\b(required|must(?:\s+have)?)\b/i;

/**
 * Extracts the verbatim mandatory-requirement lines from raw job description
 * text (bullets under a recognized "Requirements"-style header). Returns
 * lines exactly as they appear in the source text (bullet markers stripped),
 * so every returned string is traceable back to the input.
 */
export function extractMandatoryRequirementLines(jdText: string): string[] {
  const lines = jdText.split(/\r?\n/);
  const requirements: string[] = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      inSection = false;
      continue;
    }
    if (SECTION_HEADER_RE.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      const bulletMatch = line.match(BULLET_LINE_RE);
      if (bulletMatch) {
        requirements.push(bulletMatch[1]!);
      } else {
        inSection = false;
      }
    }
  }

  if (requirements.length > 0) return requirements;

  // Fallback: no recognized section header found anywhere in the text.
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length > 0 && FALLBACK_LINE_RE.test(line)) {
      requirements.push(line);
    }
  }
  return requirements;
}

/** Verbatim MasterProfile.skills[].name entries that appear in the JD text. */
export function findOverlappingSkills(
  profile: MasterProfile,
  jdTextNormalized: string,
): string[] {
  const matched: string[] = [];
  for (const skill of profile.skills) {
    if (containsPhrase(jdTextNormalized, normalize(skill.name))) {
      matched.push(skill.name);
    }
  }
  return matched;
}

/**
 * A requirement line is "covered" if any single profile skill name or role
 * title appears in it as a whole phrase.
 * GUESS: deliberately does NOT match against achievement bullet text, to
 * avoid noisy false positives from incidental word overlap in prose.
 */
export function isRequirementCovered(
  requirementLineNormalized: string,
  profile: MasterProfile,
): boolean {
  for (const skill of profile.skills) {
    if (containsPhrase(requirementLineNormalized, normalize(skill.name))) {
      return true;
    }
  }
  for (const role of profile.roles) {
    if (containsPhrase(requirementLineNormalized, normalize(role.title))) {
      return true;
    }
  }
  return false;
}
