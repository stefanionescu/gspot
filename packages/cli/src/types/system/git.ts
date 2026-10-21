import type { SpawnResult } from '#cli/types/system/processes.ts';

export type GitEnvironment = { env: Record<string, string | undefined> } | { failure: SpawnResult };

export type GitRepository = { folder: string; env: Record<string, string | undefined> };

export type GitLookup = GitRepository | { failure: SpawnResult };

export type GitVariableGroups = {
    isolated: Record<string, undefined>;
    overrides: Record<string, string | undefined>;
    explicit: Record<string, string | undefined>;
};
