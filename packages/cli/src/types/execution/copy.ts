import type { GitEntry } from '#cli/types/parsers/git.ts';

export type PendingLink = { source: string; target: string };

/** Dependency trees and pending links in a working-tree copy. */
export type DependencyTreeCopy = {
    root: string;
    scratch: string;
    cancelSignal?: AbortSignal | undefined;
    copies: Map<string, string>;
    links: PendingLink[];
};

/** An installed dependency tree copied privately or linked for an in-place run. */
export type DependencyCopy = { path: string; operation: 'clone' | 'link' };

/** Native source path, Git blob or gitlink directory in a private copy. */
export type ScratchFile =
    | string
    | { entry: Omit<GitEntry, 'mode'> & { mode: Exclude<GitEntry['mode'], '160000'> }; bytes: Buffer };

export type ScratchCopyPlan = {
    root: string;
    target: string;
    files: Iterable<ScratchFile> | AsyncIterable<ScratchFile>;
    dependencies: DependencyCopy[];
    cancelSignal?: AbortSignal | undefined;
};

/** Exact source files and explicitly owned dependency trees. */
export type ScratchCopyPaths = Omit<ScratchCopyPlan, 'target' | 'files' | 'dependencies'> & {
    paths: string[];
    dependencies?: DependencyCopy[];
};

/** Ignored declaration prerequisites and the configurations that selected them. */
export type DeclarationDependencies = { copies: DependencyCopy[]; configurationPaths: Set<string> };
