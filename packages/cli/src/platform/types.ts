// Type aliases of the platform modules.

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
