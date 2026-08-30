# CV Builder — Slice 1: Master Experience Data Model & Local Store

This is Slice 1 of 4 only. It provides:

- A JSON Schema (`schema/profile.schema.json`) for the master profile (roles,
  achievements, skills, metrics).
- Matching TypeScript types (`src/types.ts`).
- Validation logic that throws structured errors on invalid data
  (`src/validate.ts`, `src/errors.ts`).
- A local repository layer to load, validate, save, and export the master
  profile as JSON on disk (`src/repository.ts`).

Not included yet (later slices): AI/resume parsing, job description
matching, ATS/gap scoring, tailoring, or any UI.

## Requirements

- Node.js >= 23.6 (uses Node's built-in TypeScript type-stripping and test
  runner — no build step, no test framework dependency).

## Setup

```bash
npm install
```

## Run tests

```bash
npm test
```

## Type-check (optional, dev-time only; not required to run the code)

```bash
npm run typecheck
```

## Usage sketch

```ts
import { loadProfile, saveProfile, exportProfile } from "./src/index.ts";

const profile = await loadProfile("./data/master-profile.json");
await saveProfile("./data/master-profile.json", profile);
await exportProfile(profile, "./data/backups/master-profile.export.json");
```
