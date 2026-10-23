import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';

export type PausedGit = { pid: number; checkout?: string };

export type ProcessOutput = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

export type StdinOptions = { stdin?: string | Uint8Array };

export type CapturedProcess = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

export type CapturedChild = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };

export type GitHookReport = {
    headRetained: boolean;
    workingBytes: string;
    indexRetained: boolean;
    reports: Record<string, unknown>[];
};

export type ProcessBackend = {
    name: string;
    execute: (command: string[], options: AsyncSpawnOptions) => SpawnResult | Promise<SpawnResult>;
};
