import { z } from 'zod';
import { LAST_EXIT_CODE } from '#cli/constants/configurations.ts';

export const findingExitCodesSchema = z.array(z.number().int().min(1).max(LAST_EXIT_CODE));

/** Argument vectors require an executable and preserve empty arguments after it. */
export const commandSchema = z
    .array(z.string())
    .min(1)
    .refine((command) => command[0] !== '', { message: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });
