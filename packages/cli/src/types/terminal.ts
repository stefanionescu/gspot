/** The selected output detail, JSON format, and terminal color. */
export type OutputOptions = { verbosity: 'quiet' | 'normal' | 'verbose'; json: boolean; color: boolean };

/** Raw verbosity flags before quiet takes precedence. */
export type VerbosityFlags = { quiet?: true; verbose?: true };

export type Columns = { scope: number; check: number };

/** A completed command rendered as text or JSON with its contractual exit code. */
export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

/** A command failure rendered as one JSON object. */
export type CommandFailureJson = { error: string; message: string };

/** A progress destination supplied by a terminal or captured test output. */
export type ProgressStream = { isTTY?: boolean; write(text: string): unknown };
