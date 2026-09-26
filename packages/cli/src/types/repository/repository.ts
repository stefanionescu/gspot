// The types of repository in this package.
import type { z } from 'zod';
import type { Policy } from '#cli/types/policy/policy.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import type { packageManifestSchema } from '#cli/repository/manifests.ts';

export type ScopeEntry = {
    name: string;
    path: string;
    configurations: string[];
    source: 'root' | 'gspot.toml' | 'workspace' | 'project';
};
export type RawEntry = { path: string; size: number; executable: boolean; symlink: boolean };
/** Source bytes observed during one run, confined to its original repository root. */
export type SourceObservations = {
    root: string;
    sources: Map<string, Buffer>;
};
// Reading vale.ini without Vale: the styles and rule levels of each file-pattern section.
export type Reader = { lines: string[]; index: number };
export type Section = Map<string, string[]>;
export type HookLocation = {
    root: string;
    directory: string;
    absolute: string;
    gitRoot: string;
    stateDirectory: string;
};
export type Nature = 'source' | 'generated' | 'vendored' | 'binary';
export type TrackedFile = {
    path: string;
    prefix: Buffer;
    nature: Nature;
    natureSource?: string;
    tags: string[];
    executable: boolean;
    size: number;
    producedBy?: string;
};
export type Attribute = { matcher: (path: string) => boolean; attributes: string[] };
export type NatureVerdict = { nature: Nature; source: string; producedBy?: string };
// Reading a .shellcheckrc without ShellCheck: the rules its directives enable and disable.
export type Rules = { enable: string[]; disable: string[] };
export type Directive = { key: string; value: string; remaining: string };
export type ExistingTool = {
    tool: string;
    path: string;
    shared?: boolean;
    table?: string;
    key?: string;
    carries: NonNullable<ToolPin['takeover']>[number]['carries'];
    check?: string;
};
export type ExistingTooling = {
    configs: ExistingTool[];
    hooks: {
        kind: 'githooks' | 'husky' | 'lefthook' | 'simple-git-hooks' | 'pre-commit' | 'hooksPath';
        path: string;
        files: string[];
    }[];
    ci: string[];
    agentFiles: string[];
    rulesDirectories: string[];
    lintFolders: string[];
    lintOnlyManifests: string[];
    runner: NonNullable<Policy['runner']>['tool'] | 'yarn' | 'none';
    runnerFile?: string;
};
export type PathExpressions = { includes: string[]; excludes: string[] };
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type DependencyMap = Record<string, string>;
export type ManifestFacts = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: DependencyMap;
    installed: DependencyMap;
    scripts: Record<string, string>;
    workspaces: string[];
    installer?: string;
    engines: Record<string, string>;
    type?: string;
};
export type TomlTable = Record<string, unknown>;
export type Repository = {
    root: string;
    attributes: Attribute[];
    hasGit: boolean;
    files: TrackedFile[];
    scopes: ScopeEntry[];
};
/** What detection reads from a scope's tree once, for every manifest to look at. */
export type TreeFacts = {
    candidates: TrackedFile[];
    extensionCounts: Map<string, number>;
    names: Set<string>;
    shebangs: Set<string>;
    dependencies: Map<string, string>;
    scope: string;
};
export type Tagged = { tags: string[]; binary: boolean; shebang?: string };
