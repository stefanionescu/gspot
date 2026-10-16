import type { NumberedLine } from '#cli/types/text.ts';

/** One path rule and the headers it sets, with original source lines. */
export type HeaderBlock = { path: string; line: number; headers: { name: string; value: string; line: number }[] };

/** Parsed header rules and their syntax diagnostics. */
export type HeaderBlocks = { blocks: HeaderBlock[]; findings: NumberedLine[] };

/** Project functions and storage declarations derived from their external schema. */
export type SupabaseConfiguration = {
    storage?: { buckets?: Record<string, unknown> | undefined } | undefined;
};

/** Deno lint output including source diagnostics and analysis errors. */
export type DenoLintReport = {
    diagnostics: { filename: string; code: string; message: string; range: { start: { line: number } } }[];
    errors: { file_path: string; message: string }[];
};

export type ParsedCloudflare = { types_file: string; types_interface: string };

export type ParsedSupabase = { functions_folder: string; schemas: string[]; types_file?: string | undefined };
