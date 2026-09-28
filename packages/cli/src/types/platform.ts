// The types of platform in this package.
import type { Stats } from 'node:fs';

export type FileObservation = { bytes: Buffer; mode: number; isLink?: true };
export type Staging = { bounds: Bounds; path: string; target: string; temporary: string };
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
export type ProcessTermination = {
    stopped: boolean;
    failure: Error | undefined;
    drainTimer: ReturnType<typeof setTimeout> | undefined;
};
export type BinarySpawnResult = Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array };
export type EmbeddedIndex = Record<string, string>;
export type Proposed = ReadonlyMap<string, FileObservation | undefined>;
export type PathFormat = 'portable' | 'native';
export type Bounds = {
    canonical: string;
    pathFormat: PathFormat;
    partsOf: (path: string) => string[];
    locks: Map<string, string>;
};
export type Root = {
    source(path: string): string;
    list(path?: string): string[];
    stat(path: string): Stats | undefined;
    validate(path: string, value: FileObservation, proposed?: ReadonlyMap<string, FileObservation | undefined>): void;
    readEntry(path: string): FileObservation | undefined;
    read(path: string): FileObservation | undefined;
    write(path: string, value: FileObservation, expected: FileObservation | undefined): void;
    remove(path: string, expected: FileObservation): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    lock(path: string): void;
    close(): void;
};
/** A third-party license text the release notices embed, pinned by its digest. */
export type UpstreamNotice = {
    source: string;
    checksum: string;
    attribution?: string;
    omitTemplateCopyright?: boolean;
};
