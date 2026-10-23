export type OutputOptions = { json: boolean; color: boolean };

export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

export type CommandFailureJson = { error: string; message: string };

export type CommandCompletion = (result: CommandResult) => void;

export type CanceledCommandJson = { error: 'canceled'; message: string; exitCode: number };
