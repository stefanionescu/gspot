/** What a glob scan includes: dot files, folders beside files, and how links are treated. */
export type GlobOptions = {
    dot?: boolean;
    onlyFiles?: boolean;
    followSymlinks?: boolean;
    refuseBrokenLinks?: boolean;
};

/** One pattern's walk over a folder: what it matches, how deep it goes, and where each match goes. */
export type GlobWalk = {
    cwd: string;
    options: Required<GlobOptions>;
    matches: (path: string) => boolean;
    depth: number;
    skipsHidden: boolean;
    visited: Set<string>;
    isPruned?: (folder: string) => boolean;
    visit: (path: string) => void;
};

/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

/** A file path consumed by platform directory calculations. */
export type PathEntry = { path: string };
