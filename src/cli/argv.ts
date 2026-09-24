/**
 * GUESS: minimal `command --flag value --flag value` parser. No short
 * flags, no `--flag=value` syntax, no boolean flags. This is enough for
 * this slice's two commands (score, tailor) and nothing else.
 */
export interface ParsedArgs {
  command?: string;
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (key !== undefined && key.startsWith("--") && value !== undefined) {
      flags[key.slice(2)] = value;
    }
  }
  return { command, flags };
}
