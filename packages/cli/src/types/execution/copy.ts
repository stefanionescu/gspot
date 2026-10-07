import type { GitEntry } from '#cli/types/parsers/git.ts';
import type { StagedPaths } from '#cli/types/repository/revisions.ts';

export type TreeCopy = { source: string; target: string };

/** Dependency trees and pending links in a working-tree copy. */
export type WorktreeCopy = {
    root: string;
    scratch: string;
    cancelSignal?: AbortSignal | undefined;
    copies: Map<string, string>;
    links: TreeCopy[];
};

/** What a copy stands for: the staged index or a pushed commit, and the repository whose tools it runs. */
export type RevisionSource = {
    commits?: string[];
    historyComplete?: boolean;
    content: 'index' | 'commit';
    installedRoot: string;
    reference: string;
    reportRoot?: string;
    staged?: StagedPaths;
    changed?: string[];
};

export type DependencyFolder = { folder: string; dependency: string };

/** An installed dependency tree copied privately or linked for an in-place run. */
export type DependencyCopy = { path: string; operation: 'clone' | 'link' };

/** Native source path, Git blob or gitlink directory in a private copy. */
export type ScratchFile =
    | string
    | { entry: Omit<GitEntry, 'mode'> & { mode: Exclude<GitEntry['mode'], '160000'> }; bytes: Buffer };

export type ScratchCopy = {
    root: string;
    target: string;
    files: Iterable<ScratchFile> | AsyncIterable<ScratchFile>;
    dependencies: DependencyCopy[];
    cancelSignal?: AbortSignal | undefined;
};

/** Exact native source files and explicitly owned dependency trees. */
export type ScratchSource = Omit<ScratchCopy, 'target' | 'files'> & { paths: string[] };
