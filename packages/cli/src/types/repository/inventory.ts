import type { z } from 'zod';
import type { Ignore } from 'ignore';
import type { Dirent } from 'node:fs';
import type { fileKindSchema, vendoredSchema, generatedSchema } from '#cli/parsers/schema/inventory.ts';

export type PathIgnore = { base: string; matcher: Ignore };

export type PathExpressions = { includes: string[]; excludes: string[] };

export type RawEntry = { path: string; size: number; executable: boolean; symlink: boolean };

export type TrackedFile = {
    path: string;
    prefix: Buffer;
    kind: FileKind;
    kindSource?: string;
    tags: string[];
    executable: boolean;
    size: number;
    producedBy?: string;
};

export type Repository = {
    root: string;
    attributes: Map<string, Record<string, string>>;
    hasGit: boolean;
    files: TrackedFile[];
    scopes: ScopeEntry[];
};

export type Tagged = { tags: string[]; binary: boolean };

export type FileKind = z.infer<typeof fileKindSchema>;

/** A generated or vendored file entry of gspot.toml, with its kind. */
export type FileDeclaration =
    | (z.infer<typeof generatedSchema> & { kind: 'generated' })
    | (z.infer<typeof vendoredSchema> & { kind: 'vendored' });

export type Verdict = { kind: FileKind; source: string; producedBy?: string };

/** The runners that install and run gspot. */
export type Runner = 'mise' | 'npm' | 'bun' | 'pnpm' | 'yarn';

export type Tooling = {
    configs: ToolFile[];
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

export type ScopeEntry = {
    name: string;
    path: string;
    configurations: string[];
    source: 'root' | 'gspot.toml' | 'project' | 'flag';
};

export type ToolFile = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
};

/** Repository state used by module resolution without execution policy. */
export type ModuleContext = { root: string; reads: object };

/** The declared tool runner and the file that supplies it. */
export type RunnerSelection = Pick<Tooling, 'runner' | 'runnerFile'>;
/** Content evidence for classifying a tracked file prefix. */
export type ContentPrefix = { isBinary: boolean; firstLine: string };
/** Directory entries together with inherited and locally authored ignore rules. */
export type DirectoryContents = { entries: Dirent[]; rules: PathIgnore[] };
/** A directory waiting to be read with its inherited ignore rules. */
export type PendingDirectory = { directory: string; rules: PathIgnore[] };
/** A lock file that declares the repository's package manager. */
export type RunnerLock = { file: string; runner: Tooling['runner'] };

/** Captured content and location for classifying one inventory entry. */
export type FileClassification = { root: string; entry: RawEntry; prefix: Buffer; isBinary: boolean };

/** Authored declarations and effective Git attributes used for classification. */
export type FileClassificationRules = { declarations: FileDeclaration[]; attributes: Repository['attributes'] };
