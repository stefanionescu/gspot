import { z } from 'zod';
import type { Tsconfig } from '#tests/types/tools.ts';

export const tsconfigSchema = z.object({
    extends: z.string().optional(),
    include: z.string().array().optional(),
    exclude: z.string().array().optional(),
    compilerOptions: z.object({ typeRoots: z.string().array().optional() }).optional(),
}) satisfies z.ZodType<Tsconfig>;
