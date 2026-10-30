import type { z } from 'zod';
import type { NumberedLine } from '#cli/types/text.ts';
import type { supabaseProjectFileSchema } from '#cli/schemas/checks/platform.ts';

export type HeaderBlock = { path: string; headers: { name: string; value: string }[] };

export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };

export type SupabaseProjectFile = z.infer<typeof supabaseProjectFileSchema>;

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };
