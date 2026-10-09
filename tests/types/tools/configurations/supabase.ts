import type { NonSharedBuffer } from 'node:buffer';
/** The authored Supabase project files retained for preservation checks. */
export type SupabaseProjectFiles = { configPath: string; authored: NonSharedBuffer };

/** An isolated native Supabase database whose resources belong to one test. */
export type SupabaseDatabase = SupabaseProjectFiles & {
    options: { cwd: string };
    [Symbol.asyncDispose](): Promise<void>;
};
