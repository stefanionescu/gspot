import { z } from 'zod';
import semver from 'semver';
import { PACKAGE_MANAGERS } from '#cli/config/repository/package-manager.ts';
import { type PackageManager, type PackageManagerPin } from '#cli/types/repository/package-manager.ts';

const exactVersionSchema = z
    .string()
    .refine(
        (value) => semver.valid(value) !== null,
        'Package manager version must be exact.',
    ) satisfies z.ZodType<string>;

export const packageManagerPinSchema = z.strictObject({
    name: z.enum(PACKAGE_MANAGERS),
    version: z.string().optional(),
}) satisfies z.ZodType<PackageManagerPin>;

export const packageManagerSchema = packageManagerPinSchema.extend({
    version: exactVersionSchema,
}) satisfies z.ZodType<PackageManager>;
