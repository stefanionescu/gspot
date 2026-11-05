import { z } from 'zod';

export const runtimePinsSchema = z.object({
    tools: z.object({ bun: z.string(), node: z.string() }),
});

export const tsconfigSchema = z.object({
    extends: z.string().optional(),
    include: z.string().array().optional(),
    exclude: z.string().array().optional(),
    compilerOptions: z.object({ typeRoots: z.string().array().optional() }).optional(),
});
