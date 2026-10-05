import type { Root } from '#cli/types/platform/root.ts';
import type { StagedPaths } from '#cli/types/repository/revisions.ts';

export type TreeCopy = { source: string; target: string };

/** Dependency trees and pending links in a working-tree snapshot. */
export type WorktreeCopy = {
    root: string;
    scratch: string;
    files: Root;
    copies: Map<string, string>;
    pending: TreeCopy[];
    fileLinks: TreeCopy[];
};

/** What a snapshot stands for: the staged index or a pushed commit, and the repository whose tools it runs. */
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

/** An isolated source workspace with its original bytes and owned disposal. */
export type FileWorkspace = Disposable & { root: string; originals: Map<string, Buffer> };

/** The immutable revision workspace and the working tree supplying installed tools. */
export type RevisionRoots = { revision: string; working: string };
