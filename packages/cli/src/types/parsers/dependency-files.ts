import type { NPM_CLIENTS } from '#cli/config/parsers/dependency-files.ts';

export type PackageManager = { name: (typeof NPM_CLIENTS)[number]; version: string };

/** A validated package manager name and its authored or detected version, when present. */
export type PackageManagerDeclaration = { name: (typeof NPM_CLIENTS)[number]; version?: string | undefined };

export type PackageJson = {
    [x: string]: unknown;
    name?: string | undefined;
    version?: string | undefined;
    imports?: Record<string, unknown> | undefined;
    files?: string[] | undefined;
    private?: boolean | undefined;
    packageManager?: string | undefined;
    devEngines?:
        | {
              packageManager?:
                  | { name?: string | undefined; version?: string | undefined }
                  | { name?: string | undefined; version?: string | undefined }[]
                  | undefined;
          }
        | undefined;
    type?: string | undefined;
    workspaces?: string[] | { packages: string[] } | undefined;
    dependencies?: Record<string, string> | undefined;
    devDependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
    optionalDependencies?: Record<string, string> | undefined;
    scripts?: Record<string, string> | undefined;
    engines?: Record<string, string> | undefined;
};

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

/** Pure parser selected by a supported repository manifest name. */
export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type Pyproject = {
    project?:
        | {
              dependencies?: string[] | undefined;
              'optional-dependencies'?: Record<string, string[]> | undefined;
              scripts?: Record<string, string> | undefined;
              'requires-python'?: string | undefined;
          }
        | undefined;
    'dependency-groups'?: Record<string, (string | { 'include-group': string })[]> | undefined;
    tool?:
        | {
              pytest?: unknown;
              poetry?:
                  | {
                        dependencies?:
                            | Record<string, string | Record<string, unknown> | Record<string, unknown>[]>
                            | undefined;
                        group?:
                            | Record<
                                  string,
                                  {
                                      dependencies?:
                                          | Record<string, string | Record<string, unknown> | Record<string, unknown>[]>
                                          | undefined;
                                  }
                              >
                            | undefined;
                    }
                  | undefined;
          }
        | undefined;
};

export type PoetrySettings = NonNullable<NonNullable<Pyproject['tool']>['poetry']>;

/** A Python dependency version or its package-manager options. */
export type PythonDependency = string | Record<string, unknown> | Record<string, unknown>[];
