import type { Ignore } from 'ignore';
import type { Dirent } from 'node:fs';
import type { GitIndexFile } from '#cli/types/parsers/git.ts';
import type { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { FILE_KINDS } from '#cli/config/repository/files/classify.ts';
import type { DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';

export type PathIgnore = { base: string; matcher: Ignore };

export type ListedFile = { path: string; size: number; executable: boolean; symlink: boolean };

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
    files: TrackedFile[];
    dependencyFiles: DependencyFile[];
    scopeFolders: ScopeFolder[];
};

export type FileTags = { tags: string[]; isBinary: boolean };

export type FileKind = (typeof FILE_KINDS)[number];

/** A generated path that a shipped configuration declares. */
export type GeneratedPaths = { paths: string[]; kind: 'generated'; configuration: string };

export type FileClassification = { kind: FileKind; origin: string };

export type ScopeFolder = {
    path: string;
    configurations: string[];
    origin: 'root' | typeof SETTINGS_FILE | 'project';
};

/** Folder entries and the ignore rules they inherit or author. */
export type FolderListing = { children: Dirent[]; ignores: PathIgnore[] };

/** A folder waiting for a read, with its inherited ignore rules. */
export type PendingFolder = { folder: string; ignores: PathIgnore[] };

/** The generated paths that the selected configurations declare, and the Git attributes of each path. */
export type FileKindRules = { generatedPaths: GeneratedPaths[]; attributes: Repository['attributes'] };
