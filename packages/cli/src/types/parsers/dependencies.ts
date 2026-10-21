import type { PACKAGE_MANAGERS } from '#cli/config/parsers/dependencies.ts';

export type PackageManager = { name: (typeof PACKAGE_MANAGERS)[number]; version: string };

/** A validated package manager name and its authored or detected version, when present. */
export type PackageManagerDeclaration = { name: (typeof PACKAGE_MANAGERS)[number]; version?: string | undefined };

/** One package manager declared in the package.json development engine table. */
export type PackageManagerEngine = { name?: string | undefined; version?: string | undefined };

export type PackageDevEngines = {
    packageManager?: PackageManagerEngine | PackageManagerEngine[] | undefined;
};

export type PackageWorkspaces = { packages: string[] };

/** The package.json fields used for dependency and runtime detection. */
export type PackageJsonFields = {
    name?: string | undefined;
    version?: string | undefined;
    imports?: Record<string, unknown> | undefined;
    files?: string[] | undefined;
    private?: boolean | undefined;
    packageManager?: string | undefined;
    devEngines?: PackageDevEngines | undefined;
    type?: string | undefined;
    workspaces?: string[] | PackageWorkspaces | undefined;
    dependencies?: Record<string, string> | undefined;
    devDependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
    optionalDependencies?: Record<string, string> | undefined;
    scripts?: Record<string, string> | undefined;
    engines?: Record<string, string> | undefined;
};

export type PackageJson = PackageJsonFields & Record<string, unknown>;

/** An installed package, resolved from a dependency file. */
export type InstalledDependency = { path: string; version: string | undefined };

export type DependencyMap = Record<string, string>;

/** The packages and runtimes that one supported dependency file declares. */
export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: DependencyMap;
    installed: DependencyMap;
    runtimes?: Record<string, string>;
};

/** A pure parser that the name of a dependency file selects. */
export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

/** A Python dependency version or its package-manager options. */
export type PythonDependency = string | Record<string, unknown> | Record<string, unknown>[];

export type PythonGroupInclude = { 'include-group': string };

export type PythonDependencyGroup = (string | PythonGroupInclude)[];

/** The standard Python project table used for declared dependencies and runtime detection. */
export type PythonProject = {
    dependencies?: string[] | undefined;
    'optional-dependencies'?: Record<string, string[]> | undefined;
    scripts?: Record<string, string> | undefined;
    'requires-python'?: string | undefined;
};

export type PoetryGroup = { dependencies?: Record<string, PythonDependency> | undefined };

export type PoetrySettings = {
    dependencies?: Record<string, PythonDependency> | undefined;
    group?: Record<string, PoetryGroup> | undefined;
};

export type PythonToolSettings = { pytest?: unknown; poetry?: PoetrySettings | undefined };

export type Pipfile = {
    packages?: Record<string, PythonDependency> | undefined;
    'dev-packages'?: Record<string, PythonDependency> | undefined;
};

export type Pyproject = {
    project?: PythonProject | undefined;
    'dependency-groups'?: Record<string, PythonDependencyGroup> | undefined;
    tool?: PythonToolSettings | undefined;
};
