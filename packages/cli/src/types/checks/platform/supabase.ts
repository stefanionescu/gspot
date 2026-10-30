import type { z } from 'zod';
import type { supabaseProjectFileSchema } from '#cli/schemas/checks/supabase.ts';

export type SupabaseProjectFile = z.infer<typeof supabaseProjectFileSchema>;

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };
