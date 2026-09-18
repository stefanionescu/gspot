// Types of the supabase checks.

/** The part of supabase/config.toml the checks read. */
export type SupabaseProject = {
    functions?: Record<string, unknown>;
    storage?: { buckets?: Record<string, unknown> };
};

/** One diagnostic of deno lint --json. */
export type DenoDiagnostic = {
    filename: string;
    code: string;
    message: string;
    range: { start: { line: number; col: number } };
};

/** What deno lint --json prints. */
export type DenoLintReport = { diagnostics?: DenoDiagnostic[]; errors?: { file_path: string; message: string }[] };
