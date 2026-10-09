import type { readFile } from 'node:fs/promises';
/** The authored Supabase project files retained for preservation checks. */
export type SupabaseProjectFiles = {
    configPath: string;
    authored: Exclude<Awaited<ReturnType<typeof readFile>>, string>;
};

/** An isolated native Supabase database whose resources belong to one test. */
export type SupabaseDatabase = SupabaseProjectFiles & {
    options: { cwd: string };
    [Symbol.asyncDispose](): Promise<void>;
};
