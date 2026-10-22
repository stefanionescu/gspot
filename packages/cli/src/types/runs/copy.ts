import type { GitEntry } from '#cli/types/parsers/git.ts';
import type { GITLINK_MODE } from '#cli/config/parsers/git.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';

export type PendingLink = { source: string; target: string };

/** Dependency trees and pending links in a copy of the working tree. */
export type DependencyTreeCopy = {
    root: string;
    copyRoot: string;
    cancelSignal?: AbortSignal | undefined;
    copies: Map<string, string>;
    links: PendingLink[];
};

/** An installed dependency tree copied privately or linked for an in-place run. */
export type DependencyCopy = { path: string; operation: 'clone' | 'link' };

/** A source path, Git blob, or gitlink folder in a copy. */
export type CopyFile =
    | string
    | { entry: Omit<GitEntry, 'mode'> & { mode: Exclude<GitEntry['mode'], typeof GITLINK_MODE> }; bytes: Buffer };

export type CopyPlan = {
    root: string;
    target: string;
    files: Iterable<CopyFile> | AsyncIterable<CopyFile>;
    dependencies: DependencyCopy[];
    cancelSignal?: AbortSignal | undefined;
};

/** The files and installed dependency trees that a copy needs. */
export type CopyPaths = Omit<CopyPlan, 'target' | 'files'> & {
    paths: string[];
};

/** Ignored declaration prerequisites and the configurations that selected them. */
export type DeclarationDependencies = { copies: DependencyCopy[]; configurationPaths: Set<string> };

/** A disposable revision copy and the Git tree whose source it contains. */
export type RevisionCopy = TemporaryFolder & { root: string; tree: string };
