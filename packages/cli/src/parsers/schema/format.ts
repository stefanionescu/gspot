import { z } from 'zod';
import { compact } from '#cli/platform/contracts.ts';

/** The inferred fields consumed by the canonical formatting policy. */
export const formatConfigurationSchema = z
    .object({
        tabWidth: z.number().optional(),
        printWidth: z.number().optional(),
        singleQuote: z.boolean().optional(),
    })
    .transform(compact)
    .nullable();
