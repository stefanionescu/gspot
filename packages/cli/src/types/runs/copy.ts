import type { GitFile } from '#cli/types/parsers/git.ts';
import type { GITLINK_MODE } from '#cli/config/files/modes.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';

export type PendingLink = { source: string; target: string };

export type DependencyTreeCopy = {
    root: string;
    copyRoot: string;
    cancelSignal?: AbortSignal | undefined;
    copies: Map<string, string>;
    links: PendingLink[];
};

export type DependencyCopy = { path: string; operation: 'clone' | 'link' };

export type CopyFile =
    | string
    | { indexFile: Omit<GitFile, 'mode'> & { mode: Exclude<GitFile['mode'], typeof GITLINK_MODE> }; bytes: Buffer };

export type CopyPlan = {
    root: string;
    target: string;
    files: Iterable<CopyFile> | AsyncIterable<CopyFile>;
    dependencies: DependencyCopy[];
    cancelSignal?: AbortSignal | undefined;
};

export type CopyPaths = Omit<CopyPlan, 'target' | 'files'> & {
    paths: string[];
};

export type DeclarationDependencies = { copies: DependencyCopy[]; configurationPaths: Set<string> };

export type RevisionCopy = TemporaryFolder & { root: string; tree: string };
