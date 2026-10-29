import type { ErrorCode } from '#cli/types/system/errors.ts';

export type OutputOptions = { isJson: boolean; colored: boolean };

export type CommandResult<Json = unknown> = { text: string; json: Json; exitCode: number };

export type CommandFailureJson = { error: ErrorCode; message: string };

export type CommandCompletion = (result: CommandResult) => void;

export type CanceledCommandJson = { error: 'canceled'; message: string; exitCode: number };
