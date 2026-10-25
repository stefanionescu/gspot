import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/system/processes.ts';

export type PausedGit = { pid: number; checkout?: string };

export type ProcessOutput = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

export type StdinOptions = { stdin?: string | Uint8Array };

export type ProcessCapture = Pick<
    Bun.Subprocess<Bun.Spawn.Writable, 'pipe', 'pipe'>,
    'stdout' | 'stderr' | 'exitCode' | 'kill' | 'exited'
>;

export type ChildCapture = AsyncDisposable & { output: Promise<string>; errors: Promise<string> };

export type ProcessBackend = {
    name: string;
    run: (command: string[], options: AsyncSpawnOptions) => SpawnResult | Promise<SpawnResult>;
};
