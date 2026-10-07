import type { SpawnResult } from '#cli/types/platform/runtime.ts';

export type GitDiscovery = {
    cwd: string;
    argv: string[];
    env: Record<string, string | undefined>;
};

export type GitEnvironment = { env: Record<string, string | undefined> } | { failure: SpawnResult };

export type GitRepository = { directory: string; env: Record<string, string | undefined> };

export type GitSource = GitRepository | { failure: SpawnResult };

export type GitTargetEnvironment = {
    isolated: Record<string, undefined>;
    overrides: Record<string, string | undefined>;
    explicit: Record<string, string | undefined>;
};
