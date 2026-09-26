// The types of platform in this package.
import type { Stats } from 'node:fs';

export type FileSnapshot = { bytes: Buffer; mode: number; isLink?: true };
export type Staging = { confinement: Confinement; path: string; target: string; temporary: string };
export type SpawnResult = {
    code: number;
    stdout: string;
    stderr: string;
    missing: boolean;
    duration: number;
    isTimedOut?: boolean;
    isCanceled?: boolean;
    isErrored?: boolean;
};
export type SpawnOptions = {
    cwd: string;
    env?: Record<string, string | undefined>;
    stdin?: string;
    timeoutMs?: number;
};
export type AsyncSpawnOptions = SpawnOptions & {
    cancelSignal?: AbortSignal;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
};
export type BinarySpawnResult = Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array };
export type EmbeddedIndex = Record<string, string>;
export type Proposed = ReadonlyMap<string, FileSnapshot | undefined>;
export type PathFormat = 'portable' | 'native';
export type Confinement = {
    canonical: string;
    pathFormat: PathFormat;
    partsOf: (path: string) => string[];
    locks: Map<string, string>;
};
export type ConfinedRoot = {
    source(path: string): string;
    list(path?: string): string[];
    stat(path: string): Stats | undefined;
    validate(path: string, value: FileSnapshot, proposed?: ReadonlyMap<string, FileSnapshot | undefined>): void;
    readEntry(path: string): FileSnapshot | undefined;
    read(path: string): FileSnapshot | undefined;
    write(path: string, value: FileSnapshot, expected: FileSnapshot | undefined): void;
    remove(path: string, expected: FileSnapshot): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    lock(path: string): void;
    close(): void;
};
/** A third-party license text the release notices embed, pinned by its digest. */
export type UpstreamNotice = { source: string; sha256: string; attribution?: string; omitTemplateCopyright?: boolean };
