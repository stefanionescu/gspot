/** The storage buckets of `supabase/config.toml`. */
export type SupabaseProjectFile = {
    storage?: { buckets?: Record<string, unknown> | undefined } | undefined;
};

/** Deno lint output: source findings and analysis errors. */
export type DenoLintReport = {
    diagnostics: { filename: string; code: string; message: string; range: { start: { line: number } } }[];
    errors: { file_path: string; message: string }[];
};
