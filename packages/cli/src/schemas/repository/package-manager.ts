import { z } from 'zod';
import semver from 'semver';
import { PACKAGE_MANAGERS } from '#cli/config/parsers/dependencies.ts';
import { type PackageManager, type PackageManagerDeclaration } from '#cli/types/parsers/dependencies.ts';

const exactVersionSchema = z
    .string()
    .refine(
        (value) => semver.valid(value) !== null,
        'Package manager version must be exact.',
    ) satisfies z.ZodType<string>;

export const packageManagerDeclarationSchema = z.strictObject({
    name: z.enum(PACKAGE_MANAGERS),
    version: z.string().optional(),
}) satisfies z.ZodType<PackageManagerDeclaration>;

export const packageManagerSchema = packageManagerDeclarationSchema.extend({
    version: exactVersionSchema,
}) satisfies z.ZodType<PackageManager>;
