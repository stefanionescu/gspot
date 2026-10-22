/** The JSON and terminal color choices. */
export type OutputOptions = { json: boolean; color: boolean };

/** A command result, printed as text or JSON, with its exit code. */
export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

/** A command failure printed as one JSON object. */
export type CommandFailureJson = { error: string; message: string };

/** Pass one command result to the entry point of gspot. */
export type CommandCompletion = (result: CommandResult) => void;

/** A command interrupted before producing a complete result. */
export type CanceledCommandJson = { error: 'canceled'; message: string; exitCode: number };
