import type { GitFile } from '#cli/types/parsers/parsers.ts';
import type { GITLINK_MODE } from '#cli/config/files/modes.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';

export type CopyIndexFile = Omit<GitFile, 'mode'> & { mode: Exclude<GitFile['mode'], typeof GITLINK_MODE> };

export type CopyFile = string | { indexFile: CopyIndexFile; bytes: Buffer };

export type CopyPlan = {
    root: string;
    target: string;
    files: Iterable<CopyFile> | AsyncIterable<CopyFile>;
    dependencies: string[];
    cancelSignal?: AbortSignal | undefined;
};

export type CopyPaths = Omit<CopyPlan, 'target' | 'files'> & {
    paths: string[];
};

export type DeclarationDependencies = { copies: string[]; mismatched: boolean };

export type RevisionCopy = TemporaryFolder & {
    root: string;
    tree: string;
    unreadablePaths: string[];
    dependencyNote?: string;
};

export type RevisionDependencies = { dependencies: string[]; dependencyNote?: string };
