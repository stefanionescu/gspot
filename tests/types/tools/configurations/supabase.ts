/** The authored Supabase project files retained for preservation checks. */
export type SupabaseProjectFiles = { configPath: string; authored: Buffer };

/** An isolated native Supabase database whose resources belong to one test. */
export type SupabaseDatabase = SupabaseProjectFiles & {
    options: { cwd: string };
    [Symbol.asyncDispose](): Promise<void>;
};
