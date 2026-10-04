import type { z } from 'zod';
import type { denoLintReportSchema, supabaseProjectSchema } from '#cli/parsers/schema/supabase.ts';

/** Project functions and storage declarations derived from their external schema. */
export type SupabaseConfiguration = z.infer<typeof supabaseProjectSchema>;

/** Native Deno lint output including source diagnostics and analysis errors. */
export type DenoLintReport = z.infer<typeof denoLintReportSchema>;
