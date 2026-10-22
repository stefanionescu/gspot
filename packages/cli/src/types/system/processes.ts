import type { Result } from 'execa';
import type { Readable } from 'node:stream';

export type SpawnResult = {
    code: number;
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

/** What Execa reports about a finished or unstarted process, before this package classifies it. */
export type SpawnCompletion = Pick<
    Result<{ encoding: 'utf8'; reject: false }>,
    'code' | 'exitCode' | 'failed' | 'shortMessage' | 'stderr' | 'timedOut' | 'isCanceled'
> & { stdout?: string | undefined; cause?: unknown };

export type StdoutReader = (chunks: AsyncIterable<Buffer>) => Promise<void>;

/** How a process tree ended, and its stop and disposal steps. */
export type ProcessTreeControl = {
    state: { timedOut: boolean; canceled: boolean };
    stop: () => void;
    release: (executionFailure: unknown) => Promise<void>;
};

/** A running process: its completion and its stdout stream. */
export type RunningProcess = PromiseLike<SpawnCompletion> & { stdout: Readable };
