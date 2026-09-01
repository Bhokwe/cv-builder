/**
 * Minimal, deterministic ATS layout/format red-flag checks.
 *
 * GUESS: Slice 1/2 only have structured JSON data, not a rendered resume
 * document (that arrives in Slice 4), so these checks run against the raw
 * achievement bullet text for patterns known to cause problems once
 * rendered/parsed by ATS software. This is a small, literal check list, not
 * a general "resume formatting" engine.
 */
import type { MasterProfile } from "../types.ts";
import type { AtsFormatFlag } from "./types.ts";

// GUESS threshold: some ATS parsers truncate or mishandle very long lines.
const MAX_BULLET_LENGTH = 220;

const MANUAL_BULLET_PREFIX_RE = /^[•▪◦*-]\s*/;

export function checkAtsFormatFlags(profile: MasterProfile): AtsFormatFlag[] {
  const flags: AtsFormatFlag[] = [];

  for (const role of profile.roles) {
    for (const achievement of role.achievements) {
      const text = achievement.bulletPoint;

      if (MANUAL_BULLET_PREFIX_RE.test(text)) {
        flags.push({
          achievementId: achievement.id,
          reason:
            "Bullet point text begins with a manual bullet character (e.g. -, *, •); some ATS parsers misread this as content instead of formatting.",
        });
      }

      if (text.includes("\t")) {
        flags.push({
          achievementId: achievement.id,
          reason:
            "Bullet point contains a tab character, which can break ATS text extraction.",
        });
      }

      if (text.length > MAX_BULLET_LENGTH) {
        flags.push({
          achievementId: achievement.id,
          reason: `Bullet point is ${text.length} characters long (over ${MAX_BULLET_LENGTH}); some ATS parsers truncate very long lines.`,
        });
      }
    }
  }

  return flags;
}
