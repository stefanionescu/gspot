import type { Ignore } from 'ignore';
import type { Dirent } from 'node:fs';
import type { GitIndexEntry } from '#cli/types/parsers/git.ts';
import type { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { FILE_KINDS } from '#cli/config/repository/inventory.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';

export type PathIgnore = { base: string; matcher: Ignore };

export type PathExpressions = { includes: string[]; excludes: string[] };

export type FileEntry = { path: string; size: number; executable: boolean; symlink: boolean };

export type TrackedFile = {
    path: string;
    kind: FileKind;
    kindSource?: string;
    tags: string[];
    executable: boolean;
    size: number;
};

export type Repository = {
    root: string;
    attributes: Map<string, Record<string, string>>;
    hasGit: boolean;
    index: GitIndexEntry[];
    files: TrackedFile[];
    dependencyFiles: DependencyFile[];
    scopes: ScopeEntry[];
};

export type Tagged = { tags: string[]; binary: boolean };

export type FileKind = (typeof FILE_KINDS)[number];

/** A generated path declared by a selected shipped configuration. */
export type FileDeclaration = { paths: string[]; kind: 'generated'; configuration: string };

export type FileClassification = { kind: FileKind; source: string };

export type Tooling = {
    toolFiles: FoundToolFile[];
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
};

export type ScopeEntry = {
    name: string;
    path: string;
    configurations: string[];
    source: 'root' | typeof SETTINGS_FILE | 'project';
};

export type FoundToolFile = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
};

/** Content evidence for classifying a tracked file prefix. */
export type ContentPrefix = { isBinary: boolean; firstLine: string };
/** Directory entries together with inherited and locally authored ignore rules. */
export type DirectoryContents = { entries: Dirent[]; rules: PathIgnore[] };
/** A directory waiting for a read with its inherited ignore rules. */
export type PendingDirectory = { directory: string; rules: PathIgnore[] };

/** Authored declarations and effective Git attributes used for classification. */
export type FileClassificationRules = { declarations: FileDeclaration[]; attributes: Repository['attributes'] };

/** What detection reads from a scope's tree once, for every manifest to look at. */
export type ScopeContents = {
    candidates: TrackedFile[];
    extensionCounts: Map<string, number>;
    shebangs: Set<string>;
    runtimes: Map<string, string>;
    dependencies: Map<string, string>;
    scope: string;
};

/** The continuous integration fields for lint job discovery. */
export type CiJob = {
    script?: string | string[] | undefined;
    steps?: { run?: string | undefined }[] | undefined;
    extends?: unknown;
};
