/**
 * Deterministic relevance ordering for roles, achievements, and skills.
 * Reuses Slice 2's normalize/containsPhrase (read-only import) instead of
 * re-implementing text matching.
 *
 * GUESS: "relevance score" = count of Slice 2's overlappingStrengths phrases
 * found in the text. Ties are broken by original profile order (stable
 * sort), so nothing moves unless it is measurably more relevant.
 */
import { containsPhrase, normalize } from "../scoring/textMatch.ts";
import type { Achievement, Role, Skill } from "../types.ts";

function countOverlap(text: string, overlapPhrasesNormalized: string[]): number {
  const textNormalized = normalize(text);
  let count = 0;
  for (const phrase of overlapPhrasesNormalized) {
    if (containsPhrase(textNormalized, phrase)) count += 1;
  }
  return count;
}

/** Stable-sorts achievements, most relevant (highest overlap count) first. */
export function orderAchievementsByRelevance(
  achievements: Achievement[],
  overlappingStrengths: string[],
): Achievement[] {
  const overlapPhrasesNormalized = overlappingStrengths.map(normalize);
  return achievements
    .map((achievement, index) => ({
      achievement,
      index,
      score: countOverlap(achievement.bulletPoint, overlapPhrasesNormalized),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.achievement);
}

/** Stable-sorts roles, most relevant (highest total achievement overlap) first. */
export function orderRolesByRelevance(
  roles: Role[],
  overlappingStrengths: string[],
): Role[] {
  const overlapPhrasesNormalized = overlappingStrengths.map(normalize);
  return roles
    .map((role, index) => {
      const score = role.achievements.reduce(
        (sum, achievement) =>
          sum + countOverlap(achievement.bulletPoint, overlapPhrasesNormalized),
        0,
      );
      return { role, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.role);
}

/**
 * Stable-sorts skills, ones present in overlappingStrengths first.
 * Uses exact-name membership (not phrase matching): overlappingStrengths
 * are already guaranteed by Slice 2 to be verbatim skill names.
 */
export function orderSkillsByRelevance(
  skills: Skill[],
  overlappingStrengths: string[],
): Skill[] {
  const overlapNames = new Set(overlappingStrengths);
  return skills
    .map((skill, index) => ({
      skill,
      index,
      matched: overlapNames.has(skill.name) ? 1 : 0,
    }))
    .sort((a, b) => b.matched - a.matched || a.index - b.index)
    .map((entry) => entry.skill);
}
