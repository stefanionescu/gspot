// The zod schema of a profile: the policy schema without anything that names a path, with a name and a selection mode.
import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

/** The tables a profile never holds, because each one belongs to one repository. */
export const REPOSITORY_TABLES = ['scope', 'declare', 'check'] as const;

/** A profile as written. */
export const profileSchema = policySchema.omit({ scope: true, declare: true, check: true }).extend({
    profile: z.string().min(1),
    selection: z.enum(['exact', 'detect']),
});
