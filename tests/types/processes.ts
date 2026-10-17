import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';

/** A paused Git process and the checkout it started. */
export type PausedGit = { pid: number; checkout?: string };

/** What a spawned command left behind, for tests. */
export type ProcessOutput = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

/** Standard input for a CLI child process. */
export type StdinOptions = { stdin?: string | Uint8Array };
/** The streams and stop controls of a test child process. */
export type CapturedProcess = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

/** The output of a child process; disposal stops the child and reads the rest of its output. */
export type CapturedChild = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };

/** The working tree and process details that the Git hook script writes. */
export type GitHookReport = {
    headRetained: boolean;
    workingBytes: string;
    indexRetained: boolean;
    reports: Record<string, unknown>[];
};

/** One way to run a test process; each way takes the same command and gives the same result. */
export type ProcessBackend = {
    name: string;
    execute: (command: string[], options: AsyncSpawnOptions) => SpawnResult | Promise<SpawnResult>;
};
