import type { SpawnResult } from '#cli/types/system/processes.ts';

/** A stalled Git boundary and the copy path it started. */
export type PausedGit = { pid: number; checkout?: string };

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

/** Exact byte input for a live source CLI child. */
export type StdinOptions = { stdin?: string | Uint8Array };
/** The streams and termination controls owned by a test child process. */
export type CapturedProcess = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

/** Captured streams whose disposal stops and drains the owned child. */
export type CapturedChild = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };

/** The working tree and process details emitted by the Git hook probe. */
export type GitHookReport = {
    headRetained: boolean;
    workingBytes: string;
    indexRetained: boolean;
    reports: Record<string, unknown>[];
};
