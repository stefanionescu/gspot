/** The selected JSON format and terminal color. */
export type OutputOptions = { json: boolean; color: boolean };

export type Columns = { scope: number; check: number };

/** A completed command emitted as text or JSON with its contractual exit code. */
export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

/** A command failure emitted as one JSON object. */
export type CommandFailureJson = { error: string; message: string };
