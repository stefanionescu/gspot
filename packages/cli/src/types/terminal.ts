/** The selected JSON format and terminal color. */
export type OutputOptions = { json: boolean; color: boolean };

/** A completed command emitted as text or JSON with its contractual exit code. */
export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

/** A command failure emitted as one JSON object. */
export type CommandFailureJson = { error: string; message: string };

/** Deliver one completed command to the CLI entry point. */
export type CommandCompletion = (result: CommandResult) => void;

/** A command interrupted before producing a complete result. */
export type CanceledCommandJson = { error: 'canceled'; message: string; exitCode: number };
