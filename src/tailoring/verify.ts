/**
 * "Strict deterministic validation asserting no facts ... are fabricated or
 * hallucinated" (per the slice plan). Runs inside the pipeline on every
 * call (see pipeline.ts), not just in tests.
 */
import type { MasterProfile } from "../types.ts";
import type { TailoredCv } from "./types.ts";

/**
 * Thrown only if the tailoring pipeline's own output violates its
 * fact-constraint invariant against the source profile (should be
 * unreachable in normal operation — this is a safety net, not a
 * user-facing input error).
 */
export class TailoringIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TailoringIntegrityError";
  }
}

/**
 * Confirms every role, date, organization name, and bullet in tailoredCv is
 * an exact, verbatim match to something in `profile` — never invented,
 * altered, or duplicated beyond what the source contains.
 */
export function verifyTailoredCvIsFactConstrained(
  tailoredCv: TailoredCv,
  profile: MasterProfile,
): void {
  const roleById = new Map(profile.roles.map((role) => [role.id, role]));

  if (tailoredCv.roles.length > profile.roles.length) {
    throw new TailoringIntegrityError(
      `Tailored output has ${tailoredCv.roles.length} roles, more than the ${profile.roles.length} in the source profile.`,
    );
  }

  const seenRoleIds = new Set<string>();
  for (const tailoredRole of tailoredCv.roles) {
    if (seenRoleIds.has(tailoredRole.id)) {
      throw new TailoringIntegrityError(
        `Tailored output contains role id "${tailoredRole.id}" more than once.`,
      );
    }
    seenRoleIds.add(tailoredRole.id);

    const sourceRole = roleById.get(tailoredRole.id);
    if (!sourceRole) {
      throw new TailoringIntegrityError(
        `Tailored output references role id "${tailoredRole.id}", which does not exist in the source profile.`,
      );
    }
    if (
      tailoredRole.title !== sourceRole.title ||
      tailoredRole.organization !== sourceRole.organization ||
      tailoredRole.startDate !== sourceRole.startDate ||
      tailoredRole.endDate !== sourceRole.endDate
    ) {
      throw new TailoringIntegrityError(
        `Tailored role "${tailoredRole.id}" does not exactly match its source role's title/organization/dates.`,
      );
    }

    const sourceBullets = sourceRole.achievements.map((a) => a.bulletPoint);
    if (tailoredRole.bullets.length > sourceBullets.length) {
      throw new TailoringIntegrityError(
        `Tailored role "${tailoredRole.id}" has more bullets than its source role.`,
      );
    }
    const seenBullets = new Set<string>();
    for (const bullet of tailoredRole.bullets) {
      if (seenBullets.has(bullet)) {
        throw new TailoringIntegrityError(
          `Tailored role "${tailoredRole.id}" contains a duplicated bullet.`,
        );
      }
      seenBullets.add(bullet);
      if (!sourceBullets.includes(bullet)) {
        throw new TailoringIntegrityError(
          `Tailored role "${tailoredRole.id}" contains a bullet not present verbatim in the source profile: "${bullet}"`,
        );
      }
    }
  }

  if (tailoredCv.skills.length > profile.skills.length) {
    throw new TailoringIntegrityError(
      `Tailored output has ${tailoredCv.skills.length} skills, more than the ${profile.skills.length} in the source profile.`,
    );
  }
  const sourceSkillNames = profile.skills.map((skill) => skill.name);
  const seenSkills = new Set<string>();
  for (const skillName of tailoredCv.skills) {
    if (seenSkills.has(skillName)) {
      throw new TailoringIntegrityError(
        `Tailored output contains a duplicated skill: "${skillName}"`,
      );
    }
    seenSkills.add(skillName);
    if (!sourceSkillNames.includes(skillName)) {
      throw new TailoringIntegrityError(
        `Tailored output contains a skill not present verbatim in the source profile: "${skillName}"`,
      );
    }
  }
}
