// The types of repository in this package.
import type { z } from 'zod';
import type { Ignore } from 'ignore';
import type { packageManifestSchema } from '#cli/repository/packages.ts';

type Kind = 'source' | 'generated' | 'vendored' | 'binary';

export type ExistingTool = {
    tool: string;
    path: string;
    shared?: boolean;
    table?: string;
    key?: string;
};

/** A generated or vendored file entry of gspot.toml, with its kind. */
export type FileDeclaration =
    | { kind: 'generated'; paths: string[]; generator?: string | undefined; reason?: string | undefined }
    | { kind: 'vendored'; paths: string[]; reason?: string | undefined };

export type ScopeEntry = {
    name: string;
    path: string;
    kits: string[];
    source: 'root' | 'gspot.toml' | 'workspace' | 'project';
};
export type PathIgnore = { base: string; matcher: Ignore };
export type RawEntry = { path: string; size: number; executable: boolean; symlink: boolean };

export type TrackedFile = {
    path: string;
    prefix: Buffer;
    kind: Kind;
    kindSource?: string;
    tags: string[];
    executable: boolean;
    size: number;
    producedBy?: string;
};
export type Attribute = { matcher: (path: string) => boolean; attributes: string[] };
export type Verdict = { kind: Kind; source: string; producedBy?: string };

/** The runners that install and run gspot. */
export type Runner = 'mise' | 'npm' | 'bun' | 'pnpm' | 'yarn';

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
    runner: Runner | 'none';
    runnerFile?: string;
};
export type PathExpressions = { includes: string[]; excludes: string[] };
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type DependencyMap = Record<string, string>;
export type Fields = {
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

export type Repository = {
    root: string;
    attributes: Attribute[];
    hasGit: boolean;
    files: TrackedFile[];
    scopes: ScopeEntry[];
};

export type Tagged = { tags: string[]; binary: boolean; shebang?: string };
