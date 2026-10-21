import type { PackageManager } from '#cli/types/parsers/dependencies.ts';
import type { ToolProjectLockfileName } from '#cli/types/parsers/lockfiles.ts';

/** One package-manager operation with its repository routing and process limits. */
export type PackageManagerCommand = {
    work: string;
    packageManager: PackageManager;
    arguments: string[];
    failure: string;
};

/** One uv operation with its private index settings and the credentials to hide in messages. */
export type UvExecution = {
    work: string;
    commandArguments: readonly string[];
    executable: string;
    credentials: string[];
    configFile?: string;
};

/** The private routing environment and credentials of a package manager run. */
export type PackageManagerRun = {
    env: Record<string, string>;
    credentials: string[];
};

/** The lockfile and install arguments for the major version of a package manager. */
export type PackageManagerArguments = { lockfile: string[]; install: string[] };

/** Repository index settings and credentials that lockfiles must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };

/** A validated npm tool project: its package manager and lockfile. */
export type NpmToolProject = {
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

export type PythonProjectSettings = { tool: { uv: PythonIndexSettings['settings'] } };

export type PythonIndex = { url: string; [key: string]: unknown };

export type YarnSetting = { key: string };
