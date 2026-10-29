export type PackageManagerEngine = { name?: string | undefined; version?: string | undefined };

export type PackageDevEngines = {
    packageManager?: PackageManagerEngine | PackageManagerEngine[] | undefined;
};

export type PackageWorkspaces = { packages: string[] };

export type PackageJsonFields = {
    name?: string | undefined;
    version?: string | undefined;
    imports?: Record<string, unknown> | undefined;
    files?: string[] | undefined;
    packageManager?: string | undefined;
    devEngines?: PackageDevEngines | undefined;
    workspaces?: string[] | PackageWorkspaces | undefined;
    dependencies?: Record<string, string> | undefined;
    devDependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
    optionalDependencies?: Record<string, string> | undefined;
    scripts?: Record<string, string> | undefined;
    engines?: Record<string, string> | undefined;
};

export type PackageJson = PackageJsonFields & Record<string, unknown>;

export type Dependencies = Record<string, string>;

export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: Dependencies;
    installed: Dependencies;
    runtimes?: Record<string, string>;
};

export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type PythonDependency = string | Record<string, unknown> | Record<string, unknown>[];

export type PythonGroupInclude = { 'include-group': string };

export type PythonDependencyGroup = (string | PythonGroupInclude)[];

export type PythonProject = {
    dependencies?: string[] | undefined;
    'optional-dependencies'?: Record<string, string[]> | undefined;
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
