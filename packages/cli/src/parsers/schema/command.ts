import { z } from 'zod';
import { MAX_EXIT_CODE } from '#cli/config/platform/runtime.ts';

/** The stages supported by declared checks; custom commands exclude the message stage. */
export const checkStageSchema = z.enum(['commit', 'push', 'manual', 'message']);

export const findingExitCodesSchema = z.array(z.number().int().min(1).max(MAX_EXIT_CODE));

/** Argument vectors require an executable and preserve empty arguments after it. */
export const commandSchema = z
    .array(z.string())
    .min(1)
    .refine((command) => command[0] !== '', { message: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });
