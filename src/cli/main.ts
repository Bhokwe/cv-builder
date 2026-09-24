/**
 * Minimal CLI entry point. This is the only file in the slice with
 * top-level side effects (reads process.argv, writes stdout/stderr, sets
 * process.exitCode) — everything else in src/cli/ is pure and unit-testable.
 *
 * GUESS: two commands only, matching the slice's verify list exactly.
 * No help/version flags, no interactive prompts, no colored output.
 */
import { parseArgs } from "./argv.ts";
import { formatErrorForUser } from "./formatError.ts";
import { runDiagnosticWorkflow, runTailorWorkflow } from "./workflow.ts";

const USAGE = [
  "Usage:",
  "  node src/cli/main.ts score --profile <path> --jd <path>",
  "  node src/cli/main.ts tailor --profile <path> --jd <path> [--out <path>]",
].join("\n");

export async function runCli(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);

  if (command === "score") {
    if (!flags.profile || !flags.jd) {
      console.error(`Missing required --profile and/or --jd argument.\n\n${USAGE}`);
      return 1;
    }
    try {
      const { formattedReport } = await runDiagnosticWorkflow(
        flags.profile,
        flags.jd,
      );
      console.log(formattedReport);
      return 0;
    } catch (error) {
      console.error(formatErrorForUser(error));
      return 1;
    }
  }

  if (command === "tailor") {
    if (!flags.profile || !flags.jd) {
      console.error(`Missing required --profile and/or --jd argument.\n\n${USAGE}`);
      return 1;
    }
    try {
      const { markdown, savedTo } = await runTailorWorkflow(
        flags.profile,
        flags.jd,
        flags.out,
      );
      if (savedTo) {
        console.log(`Tailored CV written to ${savedTo}`);
      } else {
        console.log(markdown);
      }
      return 0;
    } catch (error) {
      console.error(formatErrorForUser(error));
      return 1;
    }
  }

  console.error(USAGE);
  return 1;
}

const exitCode = await runCli(process.argv.slice(2));
process.exitCode = exitCode;
