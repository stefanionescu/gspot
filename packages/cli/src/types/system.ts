import type { Result } from 'execa';
import type { Stats } from 'node:fs';
import type { Readable } from 'node:stream';

export type FileContents = { bytes: Buffer; mode: number; isSymlink?: true };

export type FileBounds = { root: string };

export type Files = {
    readCanonicalPath(path: string): string;
    list(path: string): string[];
    findStats(path: string): Stats | undefined;
    readKeepingLinks(path: string): FileContents | undefined;
    read(path: string): FileContents | undefined;
    write(path: string, value: FileContents): void;
    deleteFile(path: string): void;
    createPrivateFolder(path: string): void;
    deleteFolder(path: string): void;
    deleteTree(path: string): void;
};

export type TemporaryFolder = Disposable & { path: string };

export type RunCache = {
    root: string;
    sources: Map<string, Buffer>;
    texts: WeakMap<Buffer, string>;
    values: Map<symbol, Map<unknown, unknown>>;
};

export type ErrorCode =
    | 'parse'
    | 'runtime'
    | 'unexpected'
    | 'canceled'
    | 'filesystem'
    | 'settings'
    | 'configuration'
    | 'arguments'
    | 'git'
    | 'copy'
    | 'writing'
    | 'install'
    | 'tool';

export type SpawnResult = {
    code: number;
    signal?: string | undefined;
    stdout: string;
    stderr: string;
    missing: boolean;
    duration: number;
    timedOut: boolean;
    canceled: boolean;
    errored: boolean;
};

export type SpawnOptions = {
    cwd: string;
    env?: Record<string, string | undefined>;
    stdin?: string;
    timeoutSeconds?: number;
};

export type CancelableSpawnOptions = SpawnOptions & {
    cancelSignal?: AbortSignal | undefined;
};

export type ProcessTermination = {
    stopped: boolean;
    stopping?: Promise<void>;
    failure: Error | undefined;
    drainTimer: ReturnType<typeof setTimeout> | undefined;
};

export type SpawnCompletion = Pick<
    Result<{ encoding: 'utf8'; reject: false }>,
    'code' | 'exitCode' | 'signal' | 'failed' | 'shortMessage' | 'stderr' | 'timedOut' | 'isCanceled'
> & { stdout?: string | undefined; cause?: unknown };

export type StdoutReader = (chunks: AsyncIterable<Buffer>) => Promise<void>;

export type ProcessTreeControl = {
    state: { timedOut: boolean; canceled: boolean };
    stop: () => void;
    release: (processFailure: unknown) => Promise<void>;
};

export type RunningProcess = PromiseLike<SpawnCompletion> & { stdout: Readable };

export type OutputOptions = { isJson: boolean };

export type OutputState = OutputOptions & { notes: string[] };

export type CommandResult<Json extends object = Record<string, unknown>> = {
    text: string;
    json: Json & { notes?: string[] };
    exitCode: number;
    annotations?: readonly string[];
};

export type CommandFailureJson = { error: ErrorCode; message: string; stack?: string };

export type CommandJson = { version: string; exitCode: number; notes: string[] };

export type CanceledCommandJson = { error: 'canceled'; message: string };

export type TextPosition = { line: number; column: number };

export type TextRange = { start: number; end: number };
