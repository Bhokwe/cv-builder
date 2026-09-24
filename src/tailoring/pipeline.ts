import { validateProfile } from "../validate.ts";
import type { MasterProfile } from "../types.ts";
import type { GapAnalysisReport } from "../scoring/types.ts";
import {
  orderAchievementsByRelevance,
  orderRolesByRelevance,
  orderSkillsByRelevance,
} from "./ordering.ts";
import { assertAtsSafeMarkdown, renderTailoredCvToMarkdown } from "./render.ts";
import type { TailoredCv, TailoredRole } from "./types.ts";
import { verifyTailoredCvIsFactConstrained } from "./verify.ts";

/**
 * Selects (all roles/skills, none dropped — see types.ts) and reorders a
 * MasterProfile's roles, achievements, and skills to prioritize overlap
 * with a Slice 2 GapAnalysisReport. Every fact in the result is a verbatim
 * copy from `profile`; verified before returning.
 *
 * Throws ProfileValidationError (from Slice 1) if `profile` itself is not a
 * valid MasterProfile — reused as-is rather than re-implemented here.
 */
export function tailorCv(
  profile: MasterProfile,
  gapAnalysisReport: GapAnalysisReport,
): TailoredCv {
  // Defense in depth: reuse Slice 1's validator instead of re-checking shape.
  const validatedProfile = validateProfile(profile);
  const { overlappingStrengths } = gapAnalysisReport;

  const tailoredRoles: TailoredRole[] = orderRolesByRelevance(
    validatedProfile.roles,
    overlappingStrengths,
  ).map((role) => ({
    id: role.id,
    title: role.title,
    organization: role.organization,
    startDate: role.startDate,
    endDate: role.endDate,
    bullets: orderAchievementsByRelevance(
      role.achievements,
      overlappingStrengths,
    ).map((achievement) => achievement.bulletPoint),
  }));

  const tailoredSkills = orderSkillsByRelevance(
    validatedProfile.skills,
    overlappingStrengths,
  ).map((skill) => skill.name);

  const tailoredCv: TailoredCv = { roles: tailoredRoles, skills: tailoredSkills };

  // Deterministic verification logic required by the slice plan.
  verifyTailoredCvIsFactConstrained(tailoredCv, validatedProfile);

  return tailoredCv;
}

export interface TailoringPipelineResult {
  tailoredCv: TailoredCv;
  markdown: string;
}

/** tailorCv + Markdown rendering + ATS-safety check, as a single call. */
export function runTailoringPipeline(
  profile: MasterProfile,
  gapAnalysisReport: GapAnalysisReport,
): TailoringPipelineResult {
  const tailoredCv = tailorCv(profile, gapAnalysisReport);
  const markdown = renderTailoredCvToMarkdown(tailoredCv);
  assertAtsSafeMarkdown(markdown);
  return { tailoredCv, markdown };
}
