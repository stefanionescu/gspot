// The types of platform in this package.
import type { Result } from 'execa';
import type { Stats } from 'node:fs';

/** What kind of failure a GspotError reports; the command layer maps it to output and an exit code. */
export type ErrorCode =
    | 'policy'
    | 'manifest'
    | 'selection'
    | 'installation'
    | 'tool'
    | 'output'
    | 'skip'
    | 'pin'
    | 'profile'
    | 'prompt';

/** What a glob scan includes: dot files, folders beside files, and how links are treated. */
export type GlobOptions = {
    dot?: boolean;
    onlyFiles?: boolean;
    followSymlinks?: boolean;
    refuseBrokenLinks?: boolean;
};

/** One pattern's walk over a folder: what it matches, how deep it goes, and where each match goes. */
export type GlobWalk = {
    cwd: string;
    options: Required<GlobOptions>;
    matches: (path: string) => boolean;
    depth: number;
    skipsHidden: boolean;
    visited: Set<string>;
    isPruned?: (folder: string) => boolean;
    visit: (path: string) => void;
};
export type Read = { bytes: Buffer; mode: number; isLink?: true };

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
/** The spawn options of a Git command; the cancellation may be absent, as a session's is. */
export type GitOptions = Omit<AsyncSpawnOptions, 'cwd' | 'cancelSignal'> & { cancelSignal?: AbortSignal | undefined };
export type ProcessTermination = {
    stopped: boolean;
    failure: Error | undefined;
    drainTimer: ReturnType<typeof setTimeout> | undefined;
};
export type BinarySpawnResult = Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array };

/** What Execa reports about a finished or unstarted process, before this package classifies it. */
export type SpawnCompletion = Pick<
    Result<{ encoding: 'utf8'; reject: false }>,
    'code' | 'exitCode' | 'failed' | 'shortMessage' | 'stdout' | 'stderr' | 'timedOut' | 'isCanceled'
> & { cause?: unknown };

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
    validate(path: string, value: Read, proposed?: ReadonlyMap<string, Read | undefined>): void;
    readEntry(path: string): Read | undefined;
    read(path: string): Read | undefined;
    write(path: string, value: Read, expected: Read | undefined): void;
    remove(path: string, expected: Read): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    rename(from: string, to: string): void;
    removeTree(path: string): void;
    lock(path: string): void;
    close(): void;
    [Symbol.dispose](): void;
};

/** A temporary folder that removes itself when disposed. */
export type ScratchFolder = Disposable & { path: string };

export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/** Source bytes read during one run, files to its original repository root. */
export type SourceReads = {
    root: string;
    sources: Map<string, Buffer>;
};
