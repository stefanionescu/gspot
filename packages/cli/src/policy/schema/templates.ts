// The template schema retains path-independent policy and adds a template name and selection mode.
import { z } from 'zod';
import { policySchema, validateAuthoredReasons } from '#cli/policy/schema/public.ts';

/** A template as written. */
export const templateSchema = z
    .strictObject(policySchema.shape)
    .omit({ scope: true })
    .extend({
        template: z.string().min(1).optional(),
        selection: z.enum(['exact', 'detect']).optional().meta({ default: 'exact' }),
    })
    .superRefine(validateAuthoredReasons);
