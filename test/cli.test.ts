import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runDiagnosticWorkflow, runTailorWorkflow } from "../src/cli/workflow.ts";
import { formatErrorForUser } from "../src/cli/formatError.ts";
import { verifyTailoredCvIsFactConstrained } from "../src/tailoring/verify.ts";
import { assertAtsSafeMarkdown } from "../src/tailoring/render.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const scoringProfilePath = fileURLToPath(
  new URL("./fixtures/scoring-profile.json", import.meta.url),
);
const matchingJdPath = fileURLToPath(
  new URL("./fixtures/matching-job-description.txt", import.meta.url),
);
const malformedProfilePath = fileURLToPath(
  new URL("./fixtures/malformed-profile.json", import.meta.url),
);
const emptyJdPath = fileURLToPath(
  new URL("./fixtures/empty-job-description.txt", import.meta.url),
);
const nonexistentProfilePath = fileURLToPath(
  new URL("./fixtures/does-not-exist.json", import.meta.url),
);

function runCliSubprocess(args: string[]): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ["src/cli/main.ts", ...args],
    { cwd: projectRoot, encoding: "utf-8" },
  );
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

// Verify 1: input a target job description and verify diagnostic score and
// breakdown render accurately.
test("runDiagnosticWorkflow renders an accurate score and breakdown", async () => {
  const { report, formattedReport } = await runDiagnosticWorkflow(
    scoringProfilePath,
    matchingJdPath,
  );

  assert.ok(report.score >= 2, `expected score >= 2, got ${report.score}`);
  assert.ok(formattedReport.includes(`Gap score: ${report.score} / 3`));
  assert.ok(
    formattedReport.includes(
      `Requirements met: ${report.keywordMatchBreakdown.metRequirementsCount} / ${report.keywordMatchBreakdown.totalRequirements}`,
    ),
  );
  for (const strength of report.overlappingStrengths) {
    assert.ok(formattedReport.includes(strength));
  }
});

test("CLI `score` command prints an accurate score and breakdown", () => {
  const { code, stdout } = runCliSubprocess([
    "score",
    "--profile",
    scoringProfilePath,
    "--jd",
    matchingJdPath,
  ]);

  assert.equal(code, 0);
  assert.match(stdout, /Gap score: [0-3] \/ 3/);
  assert.ok(stdout.includes("TypeScript"));
  assert.ok(stdout.includes("Missing mandatory criteria:"));
});

// Verify 2: trigger CV tailoring and assert generated export contains
// strictly verified profile facts.
test("runTailorWorkflow's export contains only strictly verified profile facts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cv-builder-cli-test-"));
  const outPath = join(dir, "tailored.md");
  try {
    const { profile, tailoredCv, markdown, savedTo } = await runTailorWorkflow(
      scoringProfilePath,
      matchingJdPath,
      outPath,
    );

    assert.equal(savedTo, outPath);
    assert.doesNotThrow(() =>
      verifyTailoredCvIsFactConstrained(tailoredCv, profile),
    );

    const sourceBullets = profile.roles.flatMap((role) =>
      role.achievements.map((a) => a.bulletPoint),
    );
    for (const bulletLine of markdown.split("\n").filter((l) => l.startsWith("- "))) {
      const text = bulletLine.slice(2);
      const isKnownBullet = sourceBullets.includes(text);
      const isKnownSkill = profile.skills.some((skill) => skill.name === text);
      assert.ok(
        isKnownBullet || isKnownSkill,
        `line "${text}" is neither a verbatim source bullet nor a verbatim source skill`,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI `tailor` command writes an export containing only verified facts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cv-builder-cli-test-"));
  const outPath = join(dir, "tailored.md");
  try {
    const { code, stdout } = runCliSubprocess([
      "tailor",
      "--profile",
      scoringProfilePath,
      "--jd",
      matchingJdPath,
      "--out",
      outPath,
    ]);

    assert.equal(code, 0);
    assert.ok(stdout.includes("Tailored CV written to"));

    const exported = await readFile(outPath, "utf-8");
    const profileRaw = await readFile(scoringProfilePath, "utf-8");
    const profile = JSON.parse(profileRaw) as {
      skills: { name: string }[];
      roles: { achievements: { bulletPoint: string }[] }[];
    };
    const sourceBullets = profile.roles.flatMap((role) =>
      role.achievements.map((a) => a.bulletPoint),
    );
    for (const bulletLine of exported.split("\n").filter((l) => l.startsWith("- "))) {
      const text = bulletLine.slice(2);
      const isKnownBullet = sourceBullets.includes(text);
      const isKnownSkill = profile.skills.some((skill) => skill.name === text);
      assert.ok(isKnownBullet || isKnownSkill);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Verify 3: system handles empty, missing, or malformed inputs with clear
// human-readable errors.
test("missing profile file produces a clear human-readable error", async () => {
  try {
    await runDiagnosticWorkflow(nonexistentProfilePath, matchingJdPath);
    assert.fail("expected runDiagnosticWorkflow to throw");
  } catch (error) {
    const message = formatErrorForUser(error);
    assert.ok(message.startsWith("Could not find file:"));
    assert.ok(!message.includes("\n    at "), "message should not be a raw stack trace");
  }
});

test("malformed profile JSON produces a clear human-readable error", async () => {
  try {
    await runDiagnosticWorkflow(malformedProfilePath, matchingJdPath);
    assert.fail("expected runDiagnosticWorkflow to throw");
  } catch (error) {
    const message = formatErrorForUser(error);
    assert.ok(message.startsWith("File is not valid JSON:"));
  }
});

test("empty job description produces a clear human-readable error", async () => {
  try {
    await runDiagnosticWorkflow(scoringProfilePath, emptyJdPath);
    assert.fail("expected runDiagnosticWorkflow to throw");
  } catch (error) {
    const message = formatErrorForUser(error);
    assert.ok(message.startsWith("Cannot score this job description:"));
    assert.ok(message.includes("non-empty"));
  }
});

test("CLI exits non-zero with a human-readable error for a missing profile file", () => {
  const { code, stderr } = runCliSubprocess([
    "score",
    "--profile",
    nonexistentProfilePath,
    "--jd",
    matchingJdPath,
  ]);

  assert.equal(code, 1);
  assert.ok(stderr.includes("Could not find file:"));
  assert.ok(!stderr.includes("\n    at "), "stderr should not be a raw stack trace");
});

test("CLI exits non-zero with a usage message when required flags are missing", () => {
  const { code, stderr } = runCliSubprocess(["score", "--profile", scoringProfilePath]);

  assert.equal(code, 1);
  assert.ok(stderr.includes("Missing required --profile and/or --jd argument."));
  assert.ok(stderr.includes("Usage:"));
});

// Verify 4: exported Markdown file/output can be saved or copied cleanly.
test("exported Markdown can be saved and then copied without corruption", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cv-builder-cli-test-"));
  const savedPath = join(dir, "tailored.md");
  const copiedPath = join(dir, "tailored-copy.md");
  try {
    const { markdown, savedTo } = await runTailorWorkflow(
      scoringProfilePath,
      matchingJdPath,
      savedPath,
    );
    assert.equal(savedTo, savedPath);

    const savedContent = await readFile(savedPath, "utf-8");
    assert.equal(savedContent, markdown, "saved file must match the generated markdown exactly");
    assert.doesNotThrow(() => assertAtsSafeMarkdown(savedContent));

    await copyFile(savedPath, copiedPath);
    const copiedContent = await readFile(copiedPath, "utf-8");
    assert.equal(copiedContent, savedContent, "copied file must match the saved file exactly");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
