import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';

export const miseTasksSchema = z.object({ tasks: z.record(z.string(), z.unknown()).default({}) } satisfies SchemaShape<{
    tasks: Record<string, unknown>;
}>);
export const miseTaskAliasSchema = z.object({
    alias: (z.union([z.string(), z.array(z.string())]) satisfies z.ZodType<string | string[]>).optional(),
} satisfies SchemaShape<{ alias?: string | string[] | undefined }>);
