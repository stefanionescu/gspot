import type { Stats } from 'node:fs';

export type FileContents = { bytes: Buffer; mode: number; isSymlink?: true };

export type FileBounds = { root: string };

export type Files = {
    readCanonicalPath(path: string): string;
    list(path: string): string[];
    readStats(path: string): Stats | undefined;
    readKeepingLinks(path: string): FileContents | undefined;
    read(path: string): FileContents | undefined;
    write(path: string, value: FileContents): void;
    deleteFile(path: string): void;
    createFolder(path: string, mode: number): void;
    deleteFolder(path: string): void;
    deleteTree(path: string): void;
};

export type TemporaryFolder = Disposable & { path: string };
