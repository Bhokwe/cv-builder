/**
 * Barrel for the testable, side-effect-free pieces of the CLI.
 * Deliberately does NOT export from ./main.ts — that file has a top-level
 * side effect (it runs immediately) and must only ever be invoked as
 * `node src/cli/main.ts ...`, never imported.
 */
export { parseArgs } from "./argv.ts";
export type { ParsedArgs } from "./argv.ts";
export { formatErrorForUser } from "./formatError.ts";
export { formatGapAnalysisReport } from "./formatReport.ts";
export { runDiagnosticWorkflow, runTailorWorkflow } from "./workflow.ts";
export type {
  DiagnosticWorkflowResult,
  TailorWorkflowResult,
} from "./workflow.ts";
