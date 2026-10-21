import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';

/** The tool process options, with a timeout in seconds. */
export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type ToolAvailability = { path: string } | ProcessFailure;
export type ProcessFailure = { status: 'error' | 'missing'; note: string };
