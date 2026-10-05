import type { Stats } from 'node:fs';

/** File bytes and mode, or a symbolic link's target bytes and mode. */
export type Snapshot = { bytes: Buffer; mode: number; isLink?: true };

export type PathFormat = 'portable' | 'native';

export type Bounds = {
    canonical: string;
    pathFormat: PathFormat;
    partsOf: (path: string) => string[];
    locks: Map<string, string>;
};

export type Root = {
    /** Return the resolved path after checking that it is inside this root. */
    realPath(path: string): string;
    /** Check that an existing path resolves inside this root. */
    assertInside(path: string): void;
    /** Return sorted directory names, or an empty list if the directory is absent. */
    list(path?: string): string[];
    /** Return metadata for an entry that is not a symbolic link, or undefined if absent. */
    stat(path: string): Stats | undefined;
    /** Check the snapshot path and link target, consulting proposed entries before the disk. */
    validate(path: string, value: Snapshot, proposed?: Proposed): void;
    /** Read file bytes or a symbolic link's target bytes, or return undefined if absent. */
    readKeepingLinks(path: string): Snapshot | undefined;
    /** Read a regular file with no other hard link, or return undefined if absent. */
    read(path: string): Snapshot | undefined;
    /** Replace an entry only while its current snapshot matches expected. */
    write(path: string, value: Snapshot, expected: Snapshot | undefined): void;
    /** Create a symbolic link from the snapshot's target bytes and mode. */
    link(path: string, value: Snapshot): void;
    /** Remove an entry only while its current snapshot matches expected. */
    remove(path: string, expected: Snapshot): void;
    /** Create a directory or set the mode of an existing directory. */
    mkdir(path: string, mode: number): void;
    /** Remove an empty directory. */
    rmdir(path: string): void;
    /** Move a directory to an unused path under this root. */
    renameDirectory(from: string, to: string): void;
    /** Remove a directory tree without following links inside it. */
    removeTree(path: string): void;
    /** Acquire a writer lock, replacing a lock whose process has exited. */
    lock(path: string): void;
    /** Release the writer locks still owned by this root. */
    close(): void;
    /** Release the writer locks still owned by this root. */
    [Symbol.dispose](): void;
};

export type Proposed = ReadonlyMap<string, Snapshot | undefined>;

export type Staging = { bounds: Bounds; path: string; target: string; temporary: string };
