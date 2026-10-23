export type SupabaseProjectFile = {
    storage?: { buckets?: Record<string, unknown> | undefined } | undefined;
};

export type DenoLintReport = {
    diagnostics: { filename: string; code: string; message: string; range: { start: { line: number } } }[];
    errors: { file_path: string; message: string }[];
};
