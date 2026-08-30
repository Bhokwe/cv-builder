import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateProfile } from "./validate.ts";
import type { MasterProfile } from "./types.ts";

/**
 * Reads a JSON file from disk and validates it as a MasterProfile.
 * Throws ProfileValidationError if the contents don't match the schema,
 * or a SyntaxError if the file isn't valid JSON.
 */
export async function loadProfile(filePath: string): Promise<MasterProfile> {
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);
  return validateProfile(data);
}

/**
 * Validates a MasterProfile, then writes it to disk as formatted JSON.
 * Creates the parent directory if it doesn't exist.
 * This is the local repository's persistence operation (the "master store").
 */
export async function saveProfile(
  filePath: string,
  profile: MasterProfile,
): Promise<void> {
  const validated = validateProfile(profile);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(validated, null, 2) + "\n", "utf-8");
}

/**
 * Validates a MasterProfile, then writes a standalone copy of it to the
 * given destination path. Distinct from saveProfile only in intent: this is
 * for producing a portable snapshot of the master data (e.g. a backup or a
 * copy handed off to another tool), not for updating the primary local store.
 * GUESS: no other export formats/targets are in scope for this slice.
 */
export async function exportProfile(
  profile: MasterProfile,
  destinationPath: string,
): Promise<void> {
  await saveProfile(destinationPath, profile);
}
