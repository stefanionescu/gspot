import type { z } from 'zod';
import type { packageManifestSchema } from '#cli/repository/manifests.ts';

export type PackageManifest = z.infer<typeof packageManifestSchema>;

// What is in the tree: files, natures, tags, scopes, and the tooling init finds.

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

export type ScopeEntry = {
    name: string;
    path: string;
    presets: string[];
    source: 'root' | 'gspot.toml' | 'workspace';
};

export type Repository = {
    root: string;
    attributes: Attribute[];
    hasGit: boolean;
    files: TrackedFile[];
    scopes: ScopeEntry[];
};

export type DependencyMap = Record<string, string>;

export type ManifestFacts = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift';
    dependencies: DependencyMap;
    installed: DependencyMap;
    scripts: Record<string, string>;
    workspaces: string[];
    installer?: string;
    engines: Record<string, string>;
    type?: string;
};

export type ExistingTool = {
    tool: string;
    path: string;
};

export type ExistingTooling = {
    configs: ExistingTool[];
    hooks: { kind: 'githooks' | 'husky' | 'lefthook' | 'hooksPath'; path: string; files: string[] }[];
    ci: string[];
    agentFiles: string[];
    rulesDirectories: string[];
    lintFolders: string[];
    lintOnlyManifests: string[];
    runner: 'mise' | 'npm' | 'bun' | 'pnpm' | 'yarn' | 'uv' | 'none';
    runnerFile?: string;
};

export type Attribute = { matcher: (path: string) => boolean; attributes: string[] };

export type NatureVerdict = { nature: Nature; source: string; producedBy?: string };

export type ChangedSet = { reference: string; paths: string[] };

export type StagedSet = { staged: string[]; unstaged: number };

export type Tagged = { tags: string[]; binary: boolean; shebang?: string };

export type RawEntry = { path: string; size: number; executable: boolean; symlink: boolean };

/** What detection reads from a scope's tree once, for every manifest to look at. */
export type TreeFacts = {
    candidates: TrackedFile[];
    extensionCounts: Map<string, number>;
    names: Set<string>;
    shebangs: Set<string>;
    dependencies: Map<string, string>;
    scope: string;
};
