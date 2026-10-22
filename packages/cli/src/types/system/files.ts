import type { Stats } from 'node:fs';

/** File bytes and mode; for a symbolic link, the bytes of the path it points to and the mode of the link. */
export type FileContents = { bytes: Buffer; mode: number; isLink?: true };

export type FileBounds = {
    root: string;
    locks: Map<string, string>;
};

export type Files = {
    /** Return the resolved path after checking containment inside this root. */
    readRealPath(path: string): string;
    /** Return the sorted entry names of a folder, or an empty list if the folder does not exist. */
    list(path: string): string[];
    /** Return the stats of an entry, or undefined if absent; refuse a symbolic link. */
    readStats(path: string): Stats | undefined;
    /**
     * Read the bytes of a file, or the path that a symbolic link points to without following it; return undefined if
     * absent.
     */
    readKeepingLinks(path: string): FileContents | undefined;
    /** Read a regular file with no other hard link, or return undefined if absent. */
    read(path: string): FileContents | undefined;
    /** Replace an entry only while its file contents on disk match expected. */
    write(path: string, value: FileContents, expected: FileContents | undefined): void;
    /** Remove an entry only while its file contents on disk match expected. */
    deleteFile(path: string, expected: FileContents): void;
    /** Create a folder or set the mode of an existing folder. */
    createFolder(path: string, mode: number): void;
    /** Remove an empty folder. */
    deleteFolder(path: string): void;
    /** Remove a folder tree without following links inside it. */
    deleteTree(path: string): void;
    /** Take a writer lock, and replace a lock whose process has exited. */
    createLock(path: string): void;
    /** Release the writer locks that this root still owns. */
    [Symbol.dispose](): void;
};

/**
 * The key of a cached value: the function that creates the value. The same key object finds the same value for the
 * whole run.
 */
export type CacheKey<Value extends object> = Readonly<{ create: () => Value }>;

/** The source bytes and derived values of one run. */
export type ReadCache = {
    root: string;
    sources: Map<string, Buffer>;
    values: Map<object, object>;
};

/** A temporary folder that removes itself when disposed. */
export type TemporaryFolder = Disposable & { path: string };

/** The files to parse, whose parsed values belong to the run and its cleanup stack. */
export type CachedSourceFiles = { reads: ReadCache; resources: DisposableStack; files: { path: string }[] };

/** A stable key owns one reader, its result type, and its cleanup operation. */
export type ParseKey<Sources, Value extends object> = Readonly<{
    read: (sources: Sources) => Promise<Value>;
    dispose: (value: Value) => void;
}>;
