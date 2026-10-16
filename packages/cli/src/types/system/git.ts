import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';

export type GitEnvironment = { env: Record<string, string | undefined> } | { failure: SpawnResult };

export type GitRepository = { folder: string; env: Record<string, string | undefined> };

export type GitLookup = GitRepository | { failure: SpawnResult };

export type GitTargetEnvironment = {
    isolated: Record<string, undefined>;
    overrides: Record<string, string | undefined>;
    explicit: Record<string, string | undefined>;
};

/** Git commands share the spawn contract; the runner owns the working directory. */
export type GitOptions = Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>;
