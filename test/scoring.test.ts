import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { runGapAnalysis } from "../src/scoring/pipeline.ts";
import { checkAtsFormatFlags } from "../src/scoring/atsFormat.ts";
import { verifyNoFabrication } from "../src/scoring/verify.ts";
import { GapAnalysisInputError } from "../src/scoring/errors.ts";
import { buildDiagnosticPrompt } from "../src/scoring/prompt.ts";
import type { MasterProfile } from "../src/types.ts";

const scoringProfilePath = fileURLToPath(
  new URL("./fixtures/scoring-profile.json", import.meta.url),
);
const matchingJdPath = fileURLToPath(
  new URL("./fixtures/matching-job-description.txt", import.meta.url),
);
const mismatchedJdPath = fileURLToPath(
  new URL("./fixtures/mismatched-job-description.txt", import.meta.url),
);

async function loadScoringProfile(): Promise<MasterProfile> {
  const raw = await readFile(scoringProfilePath, "utf-8");
  return JSON.parse(raw) as MasterProfile;
}

// Verify 1: matching JD -> score >= 2 with identified overlapping strengths.
test("matching job description scores >= 2 with overlapping strengths", async () => {
  const profile = await loadScoringProfile();
  const jdText = await readFile(matchingJdPath, "utf-8");

  const report = runGapAnalysis(profile, jdText);

  assert.ok(report.score >= 2, `expected score >= 2, got ${report.score}`);
  assert.ok(
    report.overlappingStrengths.length > 0,
    "expected at least one overlapping strength",
  );
  assert.ok(report.overlappingStrengths.includes("TypeScript"));
});

// Verify 2: mismatched JD -> score is 0 or 1 with explicit missing mandatory criteria.
test("mismatched job description scores 0 or 1 with explicit missing mandatory criteria", async () => {
  const profile = await loadScoringProfile();
  const jdText = await readFile(mismatchedJdPath, "utf-8");

  const report = runGapAnalysis(profile, jdText);

  assert.ok(
    report.score === 0 || report.score === 1,
    `expected score 0 or 1, got ${report.score}`,
  );
  assert.ok(
    report.missingMandatoryCriteria.length > 0,
    "expected an explicit list of missing mandatory criteria",
  );
  assert.equal(report.keywordMatchBreakdown.totalRequirements, 4);
});

// Verify 3: missing or empty JD -> pipeline halts with a structured error.
test("empty job description text halts with a structured error", async () => {
  const profile = await loadScoringProfile();

  assert.throws(
    () => runGapAnalysis(profile, ""),
    GapAnalysisInputError,
  );
});

test("whitespace-only job description text halts with a structured error", async () => {
  const profile = await loadScoringProfile();

  try {
    runGapAnalysis(profile, "   \n  ");
    assert.fail("expected runGapAnalysis to throw");
  } catch (err) {
    assert.ok(err instanceof GapAnalysisInputError);
    assert.ok(err.issues.length > 0);
    assert.equal(err.issues[0]!.path, "jobDescriptionText");
    assert.equal(err.issues[0]!.keyword, "required");
  }
});

test("missing (undefined) job description text halts with a structured error", async () => {
  const profile = await loadScoringProfile();

  try {
    runGapAnalysis(profile, undefined);
    assert.fail("expected runGapAnalysis to throw");
  } catch (err) {
    assert.ok(err instanceof GapAnalysisInputError);
    assert.equal(err.issues[0]!.path, "jobDescriptionText");
  }
});

// Verify 4: output report contains zero fabricated skills or metrics.
test("matching report contains no fabricated overlapping strengths", async () => {
  const profile = await loadScoringProfile();
  const jdText = await readFile(matchingJdPath, "utf-8");

  const report = runGapAnalysis(profile, jdText);
  const knownSkillNames = profile.skills.map((skill) => skill.name);

  for (const strength of report.overlappingStrengths) {
    assert.ok(
      knownSkillNames.includes(strength),
      `"${strength}" is not a verbatim skill name from the master profile`,
    );
  }

  // Deterministic verification logic itself must not throw.
  assert.doesNotThrow(() => verifyNoFabrication(report, profile, jdText));
});

test("mismatched report's missing criteria are verbatim excerpts of the job description", async () => {
  const profile = await loadScoringProfile();
  const jdText = await readFile(mismatchedJdPath, "utf-8");

  const report = runGapAnalysis(profile, jdText);

  for (const criterion of report.missingMandatoryCriteria) {
    assert.ok(
      jdText.includes(criterion),
      `"${criterion}" is not a verbatim excerpt of the job description`,
    );
  }

  assert.doesNotThrow(() => verifyNoFabrication(report, profile, jdText));
});

// Covers the ATS-format-flags half of "what I add" (not otherwise exercised
// by the 4 verify-list items above).
test("checkAtsFormatFlags flags manual bullet characters, tabs, and overlong bullets", () => {
  const longText = "x".repeat(230);
  const profile: MasterProfile = {
    schemaVersion: "1.0.0",
    profileId: "profile-ats-flag-fixture",
    roles: [
      {
        id: "role-1",
        title: "Engineer",
        organization: "Acme Corp",
        startDate: "2020-01",
        endDate: null,
        achievements: [
          {
            id: "ach-bad-bullet",
            bulletPoint: "• Shipped a new checkout flow",
            metrics: [],
          },
          {
            id: "ach-bad-tab-and-length",
            bulletPoint: `Did a lot of things\twith tabs and length: ${longText}`,
            metrics: [],
          },
          {
            id: "ach-clean",
            bulletPoint: "Shipped a new checkout flow end to end.",
            metrics: [],
          },
        ],
      },
    ],
    skills: [],
  };

  const flags = checkAtsFormatFlags(profile);

  assert.ok(
    flags.some(
      (flag) =>
        flag.achievementId === "ach-bad-bullet" &&
        flag.reason.includes("manual bullet character"),
    ),
  );
  assert.ok(
    flags.some(
      (flag) =>
        flag.achievementId === "ach-bad-tab-and-length" &&
        flag.reason.includes("tab character"),
    ),
  );
  assert.ok(
    flags.some(
      (flag) =>
        flag.achievementId === "ach-bad-tab-and-length" &&
        flag.reason.includes("characters long"),
    ),
  );
  assert.ok(
    !flags.some((flag) => flag.achievementId === "ach-clean"),
    "clean bullet point should not be flagged",
  );
});

// Covers src/scoring/prompt.ts, the unused-but-shipped LLM prompt artifact
// (not otherwise exercised anywhere else, including runGapAnalysis).
test("buildDiagnosticPrompt returns a populated prompt containing profile skills and the JD text", async () => {
  const profile = await loadScoringProfile();
  const jdText = await readFile(matchingJdPath, "utf-8");

  const prompt = buildDiagnosticPrompt(profile, jdText);

  assert.equal(typeof prompt, "string");
  assert.ok(prompt.length > 0, "expected a non-empty prompt string");
  for (const skill of profile.skills) {
    assert.ok(
      prompt.includes(skill.name),
      `expected prompt to include skill "${skill.name}"`,
    );
  }
  assert.ok(
    prompt.includes(jdText),
    "expected prompt to include the job description text verbatim",
  );
});
