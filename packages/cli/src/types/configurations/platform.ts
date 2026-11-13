import type { z } from 'zod';

import type { supabaseProjectFileSchema } from '#cli/schemas/configurations.ts';
import type { NumberedLine } from '#cli/types/parsers.ts';

export type HeaderBlock = { path: string; headers: Array<{ name: string; value: string }> };

export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };

export type SupabaseProjectFile = z.infer<typeof supabaseProjectFileSchema>;

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };
