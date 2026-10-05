import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

/** A subprocess step bounded by the remaining scenario time. */
export type TestStep = { options: AsyncSpawnOptions & { timeoutMs: number }; context: string };

/** An external subprocess invocation captured with its selected working directory. */
export type CapturedInvocation = { argv: string[]; cwd: string };

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

/** Input and deadline settings passed to a source CLI subprocess. */
export type GspotSpawnOptions = Pick<AsyncSpawnOptions, 'stdin' | 'timeoutMs'>;

/** Exact byte input and a requested deadline for a live source CLI child. */
export type GspotChildOptions = Pick<AsyncSpawnOptions, 'timeoutMs'> & { stdin?: string | Uint8Array };
