import type { Stats } from 'node:fs';

/** File bytes and mode, or a symbolic link's target bytes and mode. */
export type FileCopy = { bytes: Buffer; mode: number; isLink?: true };

export type PathFormat = 'portable' | 'system';

export type SafeFolderState = {
    root: string;
    pathFormat: PathFormat;
    partsOf: (path: string) => string[];
    locks: Map<string, string>;
};

export type SafeFolder = {
    /** Return the resolved path after checking containment inside this root. */
    realPath(path: string): string;
    /** Return sorted directory names, or an empty list if the directory does not exist. */
    list(path?: string): string[];
    /** Return metadata for an entry excluding symbolic links, or undefined if absent. */
    stat(path: string): Stats | undefined;
    /** Check the copy path and link target, consulting proposed entries before the disk. */
    validate(path: string, value: FileCopy, plannedFiles?: PlannedFiles): void;
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

export type PlannedFiles = ReadonlyMap<string, FileCopy | undefined>;
