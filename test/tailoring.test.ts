import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  runTailoringPipeline,
  tailorCv,
} from "../src/tailoring/pipeline.ts";
import { assertAtsSafeMarkdown, renderTailoredCvToMarkdown } from "../src/tailoring/render.ts";
import { verifyTailoredCvIsFactConstrained } from "../src/tailoring/verify.ts";
import { buildTailoringPrompt } from "../src/tailoring/prompt.ts";
import { runGapAnalysis } from "../src/scoring/pipeline.ts";
import type { GapAnalysisReport } from "../src/scoring/types.ts";
import type { MasterProfile } from "../src/types.ts";

const tailoringProfilePath = fileURLToPath(
  new URL("./fixtures/tailoring-profile.json", import.meta.url),
);
const scoringProfilePath = fileURLToPath(
  new URL("./fixtures/scoring-profile.json", import.meta.url),
);
const matchingJdPath = fileURLToPath(
  new URL("./fixtures/matching-job-description.txt", import.meta.url),
);

async function loadJsonFixture<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Hand-built GapAnalysisReport (rather than a real runGapAnalysis call) so
 * ordering assertions below are precise and independent of Slice 2's
 * matching heuristics. Only `overlappingStrengths` is read by tailorCv; the
 * other fields are filler that satisfies the type.
 */
function buildFixtureReport(overlappingStrengths: string[]): GapAnalysisReport {
  return {
    score: 3,
    overlappingStrengths,
    missingMandatoryCriteria: [],
    keywordMatchBreakdown: { totalRequirements: 0, metRequirementsCount: 0 },
    atsFormatFlags: [],
  };
}

// Verify 1: tailored output contains only roles, skills, and bullets present
// in the source profile.
test("tailored output contains only roles, skills, and bullets present in the source profile", async () => {
  const profile = await loadJsonFixture<MasterProfile>(tailoringProfilePath);
  const report = buildFixtureReport(["TypeScript", "Node.js", "PostgreSQL"]);

  const tailoredCv = tailorCv(profile, report);

  const sourceRoleIds = new Set(profile.roles.map((role) => role.id));
  const sourceSkillNames = new Set(profile.skills.map((skill) => skill.name));

  for (const role of tailoredCv.roles) {
    assert.ok(sourceRoleIds.has(role.id), `role "${role.id}" not in source profile`);
    const sourceRole = profile.roles.find((r) => r.id === role.id)!;
    const sourceBullets = sourceRole.achievements.map((a) => a.bulletPoint);
    for (const bullet of role.bullets) {
      assert.ok(
        sourceBullets.includes(bullet),
        `bullet not present in source role "${role.id}": "${bullet}"`,
      );
    }
  }
  for (const skillName of tailoredCv.skills) {
    assert.ok(sourceSkillNames.has(skillName), `skill "${skillName}" not in source profile`);
  }

  assert.doesNotThrow(() => verifyTailoredCvIsFactConstrained(tailoredCv, profile));
});

// Verify 2: output orders experiences/bullets prioritizing overlapping
// criteria identified by Slice 2 scoring.
test("output orders roles, bullets, and skills prioritizing Slice 2's overlapping strengths", async () => {
  const profile = await loadJsonFixture<MasterProfile>(tailoringProfilePath);
  const report = buildFixtureReport(["TypeScript", "Node.js", "PostgreSQL"]);

  const tailoredCv = tailorCv(profile, report);

  // Source role order is [role-irrelevant, role-relevant]; the relevant
  // role (3 overlapping mentions) must be reordered ahead of the
  // irrelevant one (0 overlapping mentions).
  assert.deepEqual(
    tailoredCv.roles.map((role) => role.id),
    ["role-relevant", "role-irrelevant"],
  );

  // Source bullet order for role-relevant is
  // [ach-no-overlap, ach-overlap-1, ach-overlap-2]; overlap counts are
  // [0, 2, 1], so the reordered bullet text must be
  // [overlap-1 text, overlap-2 text, no-overlap text].
  const relevantRole = tailoredCv.roles.find((role) => role.id === "role-relevant")!;
  assert.deepEqual(relevantRole.bullets, [
    "Built REST APIs in TypeScript and Node.js for the checkout service.",
    "Migrated the primary database to PostgreSQL, improving query latency by 35%.",
    "Organized quarterly team offsite events.",
  ]);

  // Source skill order is [Marketing, TypeScript, Node.js, PostgreSQL];
  // the 3 overlapping skills must be reordered ahead of Marketing.
  assert.deepEqual(tailoredCv.skills, [
    "TypeScript",
    "Node.js",
    "PostgreSQL",
    "Marketing",
  ]);
});

// Verify 3: no new metrics, dates, or organization names exist in output
// that were not in the input profile.
test("output introduces no new metrics, dates, or organization names", async () => {
  const profile = await loadJsonFixture<MasterProfile>(tailoringProfilePath);
  const report = buildFixtureReport(["TypeScript", "Node.js", "PostgreSQL"]);

  const { tailoredCv, markdown } = runTailoringPipeline(profile, report);

  const sourceDates = new Set(
    profile.roles.flatMap((role) => [role.startDate, role.endDate]).filter(Boolean),
  );
  const sourceOrganizations = new Set(profile.roles.map((role) => role.organization));
  const sourceBulletText = profile.roles.flatMap((role) =>
    role.achievements.map((a) => a.bulletPoint),
  );

  for (const dateMatch of markdown.match(/\d{4}-\d{2}/g) ?? []) {
    assert.ok(sourceDates.has(dateMatch), `date "${dateMatch}" not in source profile`);
  }
  for (const role of tailoredCv.roles) {
    assert.ok(
      sourceOrganizations.has(role.organization),
      `organization "${role.organization}" not in source profile`,
    );
  }
  // Every number-like token (e.g. a percentage) in the rendered output must
  // appear verbatim inside some source bullet — i.e. it was copied, not
  // introduced by tailoring.
  for (const numberToken of markdown.match(/\d+%/g) ?? []) {
    assert.ok(
      sourceBulletText.some((bullet) => bullet.includes(numberToken)),
      `numeric token "${numberToken}" does not trace back to a source bullet`,
    );
  }
});

// Verify 4: output formats cleanly to ATS-safe plain text/Markdown structure.
test("rendered output is ATS-safe Markdown", async () => {
  const profile = await loadJsonFixture<MasterProfile>(tailoringProfilePath);
  const report = buildFixtureReport(["TypeScript", "Node.js", "PostgreSQL"]);

  const tailoredCv = tailorCv(profile, report);
  const markdown = renderTailoredCvToMarkdown(tailoredCv);

  assert.doesNotThrow(() => assertAtsSafeMarkdown(markdown));
  assert.ok(!markdown.includes("|"), "should contain no table syntax");
  assert.ok(!markdown.includes("!["), "should contain no image syntax");
  assert.ok(!/<[a-z][^>]*>/i.test(markdown), "should contain no HTML tags");
  assert.ok(!markdown.includes("\t"), "should contain no tab characters");

  assert.ok(markdown.startsWith("# Experience"));
  assert.ok(markdown.includes("# Skills"));
  assert.ok(markdown.includes("- TypeScript"));
  assert.ok(
    markdown.includes("- Built REST APIs in TypeScript and Node.js for the checkout service."),
  );
});

// Integration check: Slice 3 actually consumes a real Slice 2 report (not
// just a hand-built fixture), without either slice needing modification.
test("tailorCv composes with a real runGapAnalysis report without throwing", async () => {
  const profile = await loadJsonFixture<MasterProfile>(scoringProfilePath);
  const jdText = await readFile(matchingJdPath, "utf-8");

  const report = runGapAnalysis(profile, jdText);
  const { tailoredCv } = runTailoringPipeline(profile, report);

  assert.equal(tailoredCv.roles.length, profile.roles.length);
  assert.equal(tailoredCv.skills.length, profile.skills.length);
  assert.doesNotThrow(() => verifyTailoredCvIsFactConstrained(tailoredCv, profile));
});

// Covers src/tailoring/prompt.ts, the unused-but-shipped LLM prompt
// artifact (not otherwise exercised anywhere else, including tailorCv).
test("buildTailoringPrompt returns a populated prompt containing profile and report data", async () => {
  const profile = await loadJsonFixture<MasterProfile>(tailoringProfilePath);
  const report = buildFixtureReport(["TypeScript", "Node.js", "PostgreSQL"]);

  const prompt = buildTailoringPrompt(profile, report);

  assert.equal(typeof prompt, "string");
  assert.ok(prompt.length > 0, "expected a non-empty prompt string");
  for (const skill of profile.skills) {
    assert.ok(prompt.includes(skill.name), `expected prompt to include skill "${skill.name}"`);
  }
  assert.ok(prompt.includes("TypeScript"), "expected prompt to include an overlapping strength");
});
