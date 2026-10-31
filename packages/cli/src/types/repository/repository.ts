import type { z } from 'zod';
import type { JsonValue } from '#cli/types/shapes.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { Group, Configuration } from '#cli/types/manifests.ts';
import type { ciJobSchema } from '#cli/schemas/repository/repository.ts';
import type { ListedFile, Repository, TrackedFile, ScopeFolder, GeneratedPaths } from '#cli/types/repository/files.ts';

export type ScopeContents = {
    files: TrackedFile[];
    extensionCounts: Map<string, number>;
    shebangs: Set<string>;
    runtimes: Map<string, string>;
    dependencies: Map<string, string>;
    scope: string;
};

export type ConfigurationEvidence = {
    configuration: string;
    evidence: string;
    group: Group;
    count?: number;
};

export type DetectionEvidence = { evidence: string; count?: number };

export type RepositoryReadOptions = {
    generatedPaths: GeneratedPaths[];
    scopes: Pick<ScopeFolder, 'path' | 'configurations'>[];
    configurationsByName: Map<string, Configuration>;
};

export type RepositoryListing = Pick<Repository, 'root' | 'hasGit' | 'index' | 'attributes' | 'unreadablePaths'> & {
    files: (ListedFile & { prefix: Buffer })[];
};

export type RepositorySetup = {
    conflictingConfigs: ConflictingConfig[];
    hooks: {
        kind: 'githooks' | 'husky' | 'lefthook' | 'simple-git-hooks' | 'pre-commit' | 'hooksPath';
        path: string;
        files: string[];
    }[];
    ci: string[];
    agentFiles: string[];
    ruleFolders: string[];
    lintFolders: string[];
    toolOnlyPackages: string[];
};

export type ConflictingConfig = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
};

export type CiJob = z.infer<typeof ciJobSchema>;

export type RepositoryHooks = { hooksPath: string; hooks: RepositorySetup['hooks'] };

export type WritePlan = {
    path: string;
    status: 'changed' | 'unchanged' | 'preserved';
    after?: FileContents;
};

export type ReplacementRequest = {
    path: string;
    next: FileContents;
    expected?: FileContents | undefined;
};

export type ManagedKeys = { path: string; keys: { key: KeyPath; value: JsonValue | undefined }[] };
