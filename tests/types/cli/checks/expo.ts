import type { SpawnResult } from '#cli/types/platform/runtime.ts';

/** A Doctor subprocess outcome and its expected execution error. */
export type DoctorResult = { name: string; result: SpawnResult; expected: string[] | string };
