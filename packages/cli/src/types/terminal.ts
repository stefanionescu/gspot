import type { ErrorCode } from '#cli/types/system/system.ts';

export type OutputOptions = { isJson: boolean; colored: boolean };

export type CommandResult<Json extends object = object> = { text: string; json: Json; exitCode: number };

export type CommandFailureJson = { error: ErrorCode; message: string };

export type CommandJson = { version: string; exitCode: number; notes: string[] };

export type CommandCompletion = (result: CommandResult) => void;

export type CanceledCommandJson = { error: 'canceled'; message: string };
