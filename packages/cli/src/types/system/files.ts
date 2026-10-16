import type { Stats } from 'node:fs';

/** File bytes and mode, or a symbolic link's target bytes and mode. */
export type FileCopy = { bytes: Buffer; mode: number; isLink?: true };

export type FilesState = {
    root: string;
    locks: Map<string, string>;
};

export type Files = {
    /** Return the resolved path after checking containment inside this root. */
    realPath(path: string): string;
    /** Return sorted directory names, or an empty list if the directory does not exist. */
    list(path?: string): string[];
    /** Return metadata for an entry excluding symbolic links, or undefined if absent. */
    stat(path: string): Stats | undefined;
    /** Read file bytes or a symbolic link's target bytes, or return undefined if absent. */
    readKeepingLinks(path: string): FileCopy | undefined;
    /** Read a regular file with no other hard link, or return undefined if absent. */
    read(path: string): FileCopy | undefined;
    /** Replace an entry only while its current copy matches expected. */
    write(path: string, value: FileCopy, expected: FileCopy | undefined): void;
    /** Remove an entry only while its current copy matches expected. */
    remove(path: string, expected: FileCopy): void;
    /** Create a directory or set the mode of an existing directory. */
    mkdir(path: string, mode: number): void;
    /** Remove an empty directory. */
    rmdir(path: string): void;
    /** Remove a directory tree without following links inside it. */
    removeTree(path: string): void;
    /** Acquire a writer claim, replacing a claim whose process has exited. */
    claim(path: string): void;
    /** Release the writer locks still owned by this root. */
    [Symbol.dispose](): void;
};

/** A stable producer binds a run-owned memo entry to its value type. */
export type MemoKey<Value extends object> = Readonly<{ create: () => Value }>;

/** Source bytes and derived values owned by one execution run. */
export type ReadCache = {
    root: string;
    sources: Map<string, Buffer>;
    memo: Map<MemoKey<object>, object>;
    parsed: Map<string, Promise<unknown>>;
};

/** A temporary folder that removes itself when disposed. */
export type ScratchFolder = Disposable & { path: string };
