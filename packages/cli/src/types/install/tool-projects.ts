import type { ToolProjectLockfileName } from '#cli/types/parsers/projects/lockfiles.ts';

export type NpmToolProject = {
    dependencies: Record<string, string>;
    lockfile: ToolProjectLockfileName;
    lockfilePath: string;
};

export type ToolPyproject = {
    project: { name: string; version: string; 'requires-python': string; dependencies: string[] };
    tool: { uv: { package: false } };
};

export type StaleLockfile = { path: string; kind?: 'missing' | 'changed' };
