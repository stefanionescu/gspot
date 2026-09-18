// What is in the tree: files, natures, tags, scopes, and the tooling init finds.

export type Nature = 'source' | 'generated' | 'vendored' | 'binary';

export type TrackedFile = {
    path: string;
    nature: Nature;
    natureSource?: string;
    tags: string[];
    executable: boolean;
    size: number;
    producedBy?: string;
};

export type ScopeInfo = {
    name: string;
    path: string;
    presets: string[];
    source: 'root' | 'gspot.toml' | 'workspace';
};

export type Repository = {
    root: string;
    hasGit: boolean;
    files: TrackedFile[];
    scopes: ScopeInfo[];
};

export type DependencyMap = Record<string, string>;

export type ManifestFacts = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Cargo.toml' | 'go.mod' | 'Gemfile';
    dependencies: DependencyMap;
    installed: DependencyMap;
    scripts: Record<string, string>;
    workspaces: string[];
    packageManager?: string;
    engines: Record<string, string>;
    type?: string;
};

export type ExistingTool = {
    tool: string;
    path: string;
    owned: boolean;
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
