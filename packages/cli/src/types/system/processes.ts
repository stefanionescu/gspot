import type { Result } from 'execa';
import type { Readable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';

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

export type SpawnCompletion = Pick<
    Result<{ encoding: 'utf8'; reject: false }>,
    'code' | 'exitCode' | 'failed' | 'shortMessage' | 'stderr' | 'timedOut' | 'isCanceled'
> & { stdout?: string | undefined; cause?: unknown };

export type StdoutReader = (chunks: AsyncIterable<Buffer>) => Promise<void>;

export type ProcessTreeControl = {
    state: { timedOut: boolean; canceled: boolean };
    stop: () => void;
    release: (executionFailure: unknown) => Promise<void>;
};

export type RunningProcess = PromiseLike<SpawnCompletion> & { stdout: Readable };

export type WatchedProcess = Omit<ChildProcess, 'stdout' | 'stderr'> & { stdout: Readable; stderr: Readable };
