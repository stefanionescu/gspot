import type { Stats } from 'node:fs';

export type Read = { bytes: Buffer; mode: number; isLink?: true };

export type PathFormat = 'portable' | 'native';

export type Bounds = {
    canonical: string;
    pathFormat: PathFormat;
    partsOf: (path: string) => string[];
    locks: Map<string, string>;
};

export type Root = {
    realPath(path: string): string;
    assertInside(path: string): void;
    list(path?: string): string[];
    stat(path: string): Stats | undefined;
    validate(path: string, value: Read, proposed?: Proposed): void;
    readKeepingLinks(path: string): Read | undefined;
    read(path: string): Read | undefined;
    write(path: string, value: Read, expected: Read | undefined): void;
    link(path: string, value: Read): void;
    remove(path: string, expected: Read): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    renameDirectory(from: string, to: string): void;
    removeTree(path: string): void;
    lock(path: string): void;
    close(): void;
    [Symbol.dispose](): void;
};

export type Proposed = ReadonlyMap<string, Read | undefined>;

export type Staging = { bounds: Bounds; path: string; target: string; temporary: string };
