// The template schema retains path-independent policy and adds a template name and selection mode.
import { z } from 'zod';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { REPOSITORY_TABLES } from '#cli/config/policy/templates.ts';

/** A template as written. */
export const templateSchema = policySchema
    .omit(
        Object.fromEntries(REPOSITORY_TABLES.map((key) => [key, true])) as Record<
            (typeof REPOSITORY_TABLES)[number],
            true
        >,
    )
    .extend({
        template: z.string().min(1),
        selection: z.enum(['exact', 'detect']),
    });
