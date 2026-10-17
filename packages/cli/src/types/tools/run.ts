import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';

/** The tool process options, with a timeout in seconds. */
export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type ToolAvailability = { path: string } | ExecutionFailure;
export type ExecutionFailure = { status: 'error' | 'missing'; note: string };
