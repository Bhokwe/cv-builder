/**
 * Slice 3: Fact-Constrained Tailoring Pipeline.
 *
 * GUESS: TailoredRole intentionally has no separate `metrics` field. Any
 * numbers/metrics that show up in tailored output only exist because they
 * were already embedded, verbatim, inside a copied bulletPoint string — the
 * pipeline never copies MasterProfile.Achievement.metrics separately or
 * generates new numbers. That is what makes "no new metrics" true by
 * construction rather than by a best-effort check.
 */
export interface TailoredRole {
  id: string;
  title: string;
  organization: string;
  /** YYYY-MM, copied verbatim from the source Role. */
  startDate: string;
  /** YYYY-MM, or null, copied verbatim from the source Role. */
  endDate: string | null;
  /**
   * Achievement.bulletPoint strings, copied verbatim from the source Role,
   * reordered to prioritize bullets that overlap with the Slice 2 gap
   * analysis's overlappingStrengths. Never rewritten, trimmed, or combined.
   */
  bullets: string[];
}

export interface TailoredCv {
  /**
   * Every Role from the source MasterProfile, reordered (most relevant to
   * the job description first). GUESS: this slice never removes a role —
   * "tailoring" here means reprioritizing, not filtering out real
   * experience. See ordering.ts.
   */
  roles: TailoredRole[];
  /**
   * Every Skill.name from the source MasterProfile, reordered (skills that
   * overlap with the job description first). Same no-filtering rule as
   * roles.
   */
  skills: string[];
}
