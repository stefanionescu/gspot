import type { Result } from 'execa';

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
    | 'template'
    | 'prompt';

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
    cancelSignal?: AbortSignal | undefined;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
};

/** Git commands share the spawn contract; the runner owns the working directory. */
export type GitOptions = Omit<AsyncSpawnOptions, 'cwd'>;

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

export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };
