import type { Result } from 'execa';
import type { Readable } from 'node:stream';

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
    timeoutSeconds?: number;
};

export type AsyncSpawnOptions = SpawnOptions & {
    cancelSignal?: AbortSignal | undefined;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
};

export type ProcessTermination = {
    stopped: boolean;
    failure: Error | undefined;
    drainTimer: ReturnType<typeof setTimeout> | undefined;
};

export type ByteSpawnResult = Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array };

/** What Execa reports about a finished or unstarted process, before this package classifies it. */
export type SpawnCompletion = Pick<
    Result<{ encoding: 'utf8'; reject: false }>,
    'code' | 'exitCode' | 'failed' | 'shortMessage' | 'stderr' | 'timedOut' | 'isCanceled'
> & { stdout?: string | undefined; cause?: unknown };

export type StdoutRead = 'utf8' | ((chunks: AsyncIterable<Buffer>) => Promise<void>);

/** The completion state of a process tree, and its stop and disposal operations. */
export type ProcessTreeControl = {
    state: { isTimedOut: boolean; isCanceled: boolean };
    stop: () => void;
    release: (executionFailure: unknown) => Promise<void>;
};

/** Completion and stdout required by the shared piped-process reader. */
export type RunningProcess = PromiseLike<SpawnCompletion> & { stdout: Readable };
