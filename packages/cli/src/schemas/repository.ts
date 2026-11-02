import { z } from 'zod';
import semver from 'semver';
import { GIT_MODES } from '#cli/config/repository/files.ts';
import { PACKAGE_MANAGERS } from '#cli/config/repository/javascript.ts';

export const gitFileSchema = z.object({
    mode: z.enum(GIT_MODES),
    hash: z.string(),
    path: z.string(),
});

export const gitIndexFileSchema = gitFileSchema.extend({
    stage: z.coerce.number(),
});

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

const stringRecordSchema = z.record(z.string(), z.string()).default({});

export const lintCommandPackageSchema = z.looseObject({
    scripts: stringRecordSchema,
    devDependencies: stringRecordSchema,
    'lint-staged': z.record(z.string(), z.union([z.string(), z.string().array()])).default({}),
    'simple-git-hooks': stringRecordSchema,
});
