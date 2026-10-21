import type { Stats } from 'node:fs';

/** File bytes and mode, or the target bytes and mode of a symbolic link. */
export type FileContents = { bytes: Buffer; mode: number; isLink?: true };

export type FilesState = {
    root: string;
    locks: Map<string, string>;
};

export type Files = {
    /** Return the resolved path after checking containment inside this root. */
    readRealPath(path: string): string;
    /** Return the sorted entry names of a folder, or an empty list if the folder does not exist. */
    list(path: string): string[];
    /** Return metadata for an entry excluding symbolic links, or undefined if absent. */
    readStats(path: string): Stats | undefined;
    /** Read file bytes or the target bytes of a symbolic link, or return undefined if absent. */
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
    /** Release the writer locks still owned by this root. */
    [Symbol.dispose](): void;
};

/** A stable producer binds a run-owned memo entry to its value type. */
export type MemoKey<Value extends object> = Readonly<{ create: () => Value }>;

/** The source bytes and derived values of one run. */
export type ReadCache = {
    root: string;
    sources: Map<string, Buffer>;
    memo: Map<object, object>;
};

/** A temporary folder that removes itself when disposed. */
export type ScratchFolder = Disposable & { path: string };

/** Inputs whose parsed values belong to the run and its cleanup stack. */
export type CachedParseInput = { reads: ReadCache; resources: DisposableStack; files: { path: string }[] };

/** A stable key owns one reader, its result type, and its cleanup operation. */
export type ParseKey<Input, Value extends object> = Readonly<{
    read: (input: Input) => Promise<Value>;
    dispose: (value: Value) => void;
}>;
