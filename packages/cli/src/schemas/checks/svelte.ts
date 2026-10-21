import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { SVELTE_SEVERITIES } from '#cli/config/checks/svelte.ts';
import type { SvelteFinding } from '#cli/types/checks/svelte.ts';

export const findingSchema = z.object({
    type: z.enum(SVELTE_SEVERITIES),
    filename: z.string().min(1),
    start: z.object({
        line: z.number().int().nonnegative(),
        character: z.number().int().nonnegative(),
    } satisfies SchemaShape<SvelteFinding['start']>),
    message: z.string(),
    code: (z.union([z.string(), z.number()]) satisfies z.ZodType<string | number>).optional(),
} satisfies SchemaShape<SvelteFinding>) satisfies z.ZodType<SvelteFinding>;

export const failureMessageSchema = z.string();
