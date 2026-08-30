import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateProfile } from "../src/validate.ts";
import { exportProfile, loadProfile, saveProfile } from "../src/repository.ts";
import { ProfileValidationError } from "../src/errors.ts";
import type { MasterProfile } from "../src/types.ts";

const fixturePath = fileURLToPath(
  new URL("./fixtures/valid-profile.json", import.meta.url),
);

const validProfileFixture: MasterProfile = {
  schemaVersion: "1.0.0",
  profileId: "profile-jane-doe",
  roles: [
    {
      id: "role-1",
      title: "Senior Backend Engineer",
      organization: "Acme Corp",
      startDate: "2021-03",
      endDate: null,
      achievements: [
        {
          id: "ach-1",
          bulletPoint: "Led migration of billing service to a new datastore.",
          metrics: [{ id: "met-1", label: "downtime reduction", value: "40%" }],
        },
        {
          id: "ach-2",
          bulletPoint: "Mentored two junior engineers through promotion.",
          metrics: [],
        },
      ],
    },
    {
      id: "role-2",
      title: "Software Engineer",
      organization: "Startup Inc",
      startDate: "2018-06",
      endDate: "2021-02",
      achievements: [],
    },
  ],
  skills: [
    { id: "skill-1", name: "TypeScript", category: "Languages" },
    { id: "skill-2", name: "PostgreSQL", category: "Databases" },
  ],
};

function loadFixtureRaw(): MasterProfile {
  // structuredClone avoids cross-test mutation of a shared fixture object.
  return structuredClone(validProfileFixture);
}

// Verify 1: a valid profile JSON file loads without schema errors.
test("valid profile JSON loads without schema errors", async () => {
  const profile = await loadProfile(fixturePath);
  assert.equal(profile.profileId, "profile-jane-doe");
  assert.equal(profile.roles.length, 2);
  assert.equal(profile.skills.length, 2);
});

// Verify 2: missing required fields (dates, titles, bullet points) throw
// structured validation errors.
test("missing role title throws a structured validation error", () => {
  const profile = loadFixtureRaw();
  // @ts-expect-error - intentionally deleting a required field to test validation
  delete profile.roles[0]!.title;

  assert.throws(() => validateProfile(profile), ProfileValidationError);

  try {
    validateProfile(profile);
    assert.fail("expected validateProfile to throw");
  } catch (err) {
    assert.ok(err instanceof ProfileValidationError);
    assert.ok(err.issues.length > 0);
    assert.ok(
      err.issues.some(
        (issue) =>
          issue.keyword === "required" && issue.path === "/roles/0/title",
      ),
    );
  }
});

test("missing role startDate throws a structured validation error", () => {
  const profile = loadFixtureRaw();
  // @ts-expect-error - intentionally deleting a required field to test validation
  delete profile.roles[0]!.startDate;

  try {
    validateProfile(profile);
    assert.fail("expected validateProfile to throw");
  } catch (err) {
    assert.ok(err instanceof ProfileValidationError);
    assert.ok(
      err.issues.some(
        (issue) =>
          issue.keyword === "required" && issue.path === "/roles/0/startDate",
      ),
    );
  }
});

test("missing achievement bulletPoint throws a structured validation error", () => {
  const profile = loadFixtureRaw();
  // @ts-expect-error - intentionally deleting a required field to test validation
  delete profile.roles[0]!.achievements[0]!.bulletPoint;

  try {
    validateProfile(profile);
    assert.fail("expected validateProfile to throw");
  } catch (err) {
    assert.ok(err instanceof ProfileValidationError);
    assert.ok(
      err.issues.some(
        (issue) =>
          issue.keyword === "required" &&
          issue.path === "/roles/0/achievements/0/bulletPoint",
      ),
    );
  }
});

// Verify 3: experience bullet points cannot be empty strings.
test("empty string bulletPoint throws a structured validation error", () => {
  const profile = loadFixtureRaw();
  profile.roles[0]!.achievements[0]!.bulletPoint = "";

  try {
    validateProfile(profile);
    assert.fail("expected validateProfile to throw");
  } catch (err) {
    assert.ok(err instanceof ProfileValidationError);
    assert.ok(
      err.issues.some(
        (issue) =>
          issue.keyword === "minLength" &&
          issue.path === "/roles/0/achievements/0/bulletPoint",
      ),
    );
  }
});

// Verify 4: data serializes and deserializes cleanly without losing fields.
test("profile survives a save/load round trip without losing fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cv-builder-test-"));
  const filePath = join(dir, "profile.json");
  try {
    const original = loadFixtureRaw();

    await saveProfile(filePath, original);
    const reloaded = await loadProfile(filePath);

    assert.deepEqual(reloaded, original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile survives an exportProfile/load round trip without losing fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cv-builder-test-"));
  const filePath = join(dir, "profile.export.json");
  try {
    const original = loadFixtureRaw();

    await exportProfile(original, filePath);
    const reloaded = await loadProfile(filePath);

    assert.deepEqual(reloaded, original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
