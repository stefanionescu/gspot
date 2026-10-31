import type { AsyncSpawnOptions } from '#cli/types/system/system.ts';

export type ToolRunOptions = Pick<AsyncSpawnOptions, 'cwd' | 'env' | 'stdin'> & {
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type ToolAvailability = { path: string } | ProcessFailure;
export type ProcessFailure = { status: 'error' | 'missing'; note: string };

export type InstalledDependency = { path: string; version: string | undefined };
