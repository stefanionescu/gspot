import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

export const eslintRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    flat: z.boolean(),
});
export const eslintResponse = z.strictObject({
    overrides: policySchema.shape.tools.unwrap().shape.eslint.unwrap().shape.overrides.unwrap(),
    ignores: z.array(z.strictObject({ paths: z.array(z.string().min(1)).min(1), rule: z.string().min(1).optional() })),
    notes: z.array(z.string()),
});
