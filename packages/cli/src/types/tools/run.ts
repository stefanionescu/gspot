import type { AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

/** The tool process controls, with a deadline in policy seconds. */
export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds?: number;
    cancelSignal?: AbortSignal | undefined;
};
