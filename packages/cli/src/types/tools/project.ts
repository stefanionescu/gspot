/** The repository and generated Yarn settings used during package lockfile resolution. */

/** The repository and declared wrappers verified before installing the package project. */

import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

/** One package-manager operation with its repository routing and process limits. */
export type NpmClientExecution = {
    root: string;
    work: string;
    client: NpmClient;
    argv: string[];
    failure: string;
    timeoutSeconds: number;
    steps: (readonly string[])[];
};

/** One uv operation with its private index configuration and diagnostic credentials. */
export type UvExecution = {
    work: string;
    args: readonly string[];
    executable: string;
    credentials: string[];
    timeoutSeconds: number;
    steps: (readonly string[])[];
    configFile?: string;
};

/** The isolated execution and credential-free lockfile output. */
export type NpmClientRun = {
    env: Record<string, string>;
    lockfile: string;
};

/** Native package operations for a declared manager major. */
export type NpmClientCommands = { lockfile: string[]; install: string[] };

/** Repository identity and the uv executable used during lockfile preparation. */
export type PythonPreparation = {
    root: string;
    uvPath: string;
    timeoutSeconds: number;
};
/** The validated uv lockfile of the Python tool project. */
export type PythonToolLockfile = {
    version: 1;
    'requires-python': string;
    package: {
        name: string;
        version: string;
        source: Record<string, unknown> & { virtual?: string | undefined };
        metadata: { 'requires-dist': PythonRequirement[] };
    }[];
};

/** A dependency requirement recorded by uv for root metadata. */
export type PythonRequirement = { name: string; specifier: string };

/** Authored uv configuration sources, with uv.toml taking precedence over pyproject.toml. */
export type PythonSettingsSources = { uv: string | undefined; project: string | undefined };

/** Repository index settings and credentials that lockfiles must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };

/** Validated npm tool project with the manager and lockfile it declares. */
export type NpmToolProject = {
    npmClient: NpmClient;
    dependencies: Record<string, string>;
    lockfile: ToolProjectLockfileName;
    lockfilePath: string;
};

/** The pyproject.toml generated for gspot Python tools. */
export type PythonToolProject = {
    project: { name: string; version: string; 'requires-python': string; dependencies: string[] };
    tool: { uv: { package: false } };
};

export type StaleLockfile = { path: string; kind?: 'missing' | 'changed' };

/** One package entry in a Bun lockfile. */
export type BunPackage = [identity: string, address: string, metadata: Record<string, unknown>, integrity: string];

/** The generated npm project file. Read these before package manager and lockfile parsing. */
export type NpmProjectFile = {
    private: true;
    devDependencies: Record<string, string> & { '@next/eslint-plugin-next'?: string | undefined };
};
