import type { Stats } from 'node:fs';

export type FileContents = { bytes: Buffer; mode: number; isSymlink?: true };

export type FileBounds = {
    root: string;
    locks: Map<string, string>;
};

export type Files = {
    readCanonicalPath(path: string): string;
    list(path: string): string[];
    readStats(path: string): Stats | undefined;
    readKeepingLinks(path: string): FileContents | undefined;
    read(path: string): FileContents | undefined;
    write(path: string, value: FileContents, expected: FileContents | undefined): void;
    deleteFile(path: string, expected: FileContents): void;
    createFolder(path: string, mode: number): void;
    deleteFolder(path: string): void;
    deleteTree(path: string): void;
    createLock(path: string): void;
    [Symbol.dispose](): void;
};

export type CacheKey<Value extends object> = Readonly<{ create: () => Value }>;

export type ReadCache = {
    root: string;
    sources: Map<string, Buffer>;
    values: Map<object, object>;
};

export type TemporaryFolder = Disposable & { path: string };

export type CachedSourceFiles = { reads: ReadCache; resources: DisposableStack; files: { path: string }[] };

export type ParseKey<Sources, Value extends object> = Readonly<{
    read: (sources: Sources) => Promise<Value>;
    dispose: (value: Value) => void;
}>;
