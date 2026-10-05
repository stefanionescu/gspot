export type OutputOptions = { quiet: boolean; json: boolean; color: boolean };

export type ReporterOptions = { quiet: boolean; verbose: boolean; hook?: 'pre-commit' | 'pre-push' | 'commit-msg' };

export type Columns = { scope: number; check: number };

/** A completed command rendered as text or JSON with its contractual exit code. */
export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

/** A command failure rendered as one JSON object. */
export type CommandFailureJson = { error: string; message: string };

/** A progress destination supplied by a terminal or captured test output. */
export type ProgressStream = { isTTY?: boolean; write(text: string): unknown };
