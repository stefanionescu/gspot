import type { CheckResult } from '#cli/types/execution/check.ts';
/** One invocation captured at the Supabase subprocess boundary. */
export type SupabaseInvocation = { args: string[]; cwd: string };
/** A scoped native type-generation check whose external mocks are disposed together. */
export type SupabaseProject = Disposable & {
    prefix: string;
    execute: () => Promise<CheckResult>;
    requests: SupabaseInvocation[];
};
