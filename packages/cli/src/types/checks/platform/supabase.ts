export type SupabaseProjectFile = {
    functions?: Record<string, { entrypoint?: string | undefined; import_map?: string | undefined }> | undefined;
    storage?: { buckets?: Record<string, unknown> | undefined } | undefined;
};

export type DenoLintOutput = {
    diagnostics: { filename: string; code: string; message: string; range: { start: { line: number } } }[];
    errors: { file_path: string; message: string }[];
};

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };
