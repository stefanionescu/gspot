/** What a glob scan includes: dot files, folders beside files, and how links are treated. */
export type GlobOptions = {
    dot?: boolean;
    onlyFiles?: boolean;
    followSymlinks?: boolean;
};

/** Native scans share one selection and output across positive patterns. */
export type GlobScan = {
    cwd: string;
    options: Required<GlobOptions>;
    isPruned: (folder: string) => boolean;
    visit: (path: string) => void;
};

/** A native query returns directory paths that remain within its boundary. */
export type GlobQuery = (folder: string, pattern: string) => string[];

/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

/** A file path consumed by platform directory calculations. */
export type PathEntry = { path: string };
