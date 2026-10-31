import { z } from 'zod';
import semver from 'semver';
import { PACKAGE_MANAGERS } from '#cli/config/repository/javascript.ts';

const exactVersionSchema = z
    .string()
    .refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.');

export const packageManagerPinSchema = z.strictObject({
    name: z.enum(PACKAGE_MANAGERS),
    version: z.string().optional(),
});

export const packageManagerSchema = packageManagerPinSchema.extend({
    version: exactVersionSchema,
});
