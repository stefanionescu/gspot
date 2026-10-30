import type { Ignore } from 'ignore';
import type { Dirent } from 'node:fs';
import type { FILE_KINDS } from '#cli/config/files/kinds.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { GitIndexFile } from '#cli/types/parsers/git.ts';
import type { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';

export type PathIgnore = { base: string; matcher: Ignore };

export type ListedFile = { path: string; size: number; executable: boolean; isSymlink: boolean };

export type TrackedFile = {
    path: string;
    kind: FileKind;
    kindOrigin: string;
    tags: string[];
    executable: boolean;
    size: number;
};

export type Repository = {
    root: string;
    attributes: Map<string, Record<string, string>>;
    hasGit: boolean;
    index: GitIndexFile[];
    unreadablePaths: string[];
    files: TrackedFile[];
    dependencyFiles: DependencyFile[];
    scopeFolders: ScopeFolder[];
};

export type FileTags = { tags: string[]; isBinary: boolean };

export type FileKind = (typeof FILE_KINDS)[number];

export type GeneratedPaths = { paths: string[]; kind: 'generated'; configuration: string };

export type FileClassification = { kind: FileKind; origin: string };

export type ScopeFolder = {
    path: string;
    configurations: string[];
    origin: 'root' | typeof SETTINGS_FILE | 'project';
};

export type FolderListing = { children: Dirent[]; ignores: PathIgnore[] };

export type PendingFolder = { folder: string; ignores: PathIgnore[] };

export type FileKindRules = { generatedPaths: GeneratedPaths[]; attributes: Repository['attributes'] };

export type CoveredFilesOptions = {
    configurations: Configuration[];
    scopePath: string;
    settings: Pick<ScopeSettings, 'test_files' | 'valuesByKey'>;
};
