import type { ToolProjectLockfileName } from '#cli/types/parsers/projects/lockfiles.ts';

/** A validated npm tool project: its dependencies and lockfile. */
export type NpmToolProject = {
    dependencies: Record<string, string>;
    lockfile: ToolProjectLockfileName;
    lockfilePath: string;
};

/** The pyproject.toml generated for gspot Python tools. */
export type ToolPyproject = {
    project: { name: string; version: string; 'requires-python': string; dependencies: string[] };
    tool: { uv: { package: false } };
};

export type StaleLockfile = { path: string; kind?: 'missing' | 'changed' };
