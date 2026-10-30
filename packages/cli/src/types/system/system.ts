import type { Result } from 'execa';
import type { Readable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';

export type RunCache = {
    root: string;
    sources: Map<string, Buffer>;
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
    | 'check'
    | 'tool'
    | 'output'
    | 'skip'
    | 'prompt';

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
    release: (processFailure: unknown) => Promise<void>;
};

export type RunningProcess = PromiseLike<SpawnCompletion> & { stdout: Readable };

export type WatchedProcess = Omit<ChildProcess, 'stdout' | 'stderr'> & { stdout: Readable; stderr: Readable };

export type GitEnvironment = { variables: Record<string, string | undefined> } | { failure: SpawnResult };

export type GitRepository = { folder: string; environment: Record<string, string | undefined> };

export type GitLookup = GitRepository | { failure: SpawnResult };

export type GitVariableGroups = {
    isolated: Record<string, undefined>;
    overrides: Record<string, string | undefined>;
    explicit: Record<string, string | undefined>;
};
