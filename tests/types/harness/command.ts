import type { SpawnResult, AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';

/** A subprocess step bounded by the remaining scenario time. */
export type TestStep = { options: AsyncSpawnOptions & { timeoutMs: number }; context: string };

/** An external subprocess invocation captured with its selected working directory. */
export type CapturedInvocation = { argv: string[]; cwd: string };

/** What a spawned command left behind, for tests. */
export type SpawnOutcome = Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>;

/** Input settings passed to a source CLI subprocess. */
export type GspotSpawnOptions = Pick<AsyncSpawnOptions, 'stdin'>;

/** Exact byte input for a live source CLI child. */
export type GspotChildOptions = { stdin?: string | Uint8Array };
