// Type aliases of the platform modules.

export type EmbeddedIndex = Record<string, string>;

export type SpawnResult = {
    code: number;
    stdout: string;
    stderr: string;
    missing: boolean;
    duration: number;
    fd3?: string;
    isTimedOut?: boolean;
    isCanceled?: boolean;
};

export type SpawnOptions = {
    cwd: string;
    env?: Record<string, string | undefined>;
    stdin?: string;
    timeoutMs?: number;
};

export type AsyncSpawnOptions = SpawnOptions & { cancelSignal?: AbortSignal; captureFd3?: boolean };

export type BinarySpawnResult = Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array };
