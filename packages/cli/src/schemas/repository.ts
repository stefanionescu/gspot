import semver from 'semver';
import { z } from 'zod';

import { GIT_MODES } from '#cli/config/repository/files.ts';
import { PACKAGE_MANAGERS } from '#cli/config/repository/package-managers.ts';
import { configTableSchema, stringValuesSchema } from '#cli/schemas/parsers.ts';

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

const stringListSchema = configTableSchema.transform((table) =>
    Object.values(table)
        .flat()
        .filter((value) => typeof value === 'string'),
);

const preCommitHooksSchema = z
    .looseObject({
        id: z.string(),
        entry: z.string().optional(),
        language: z.string().optional(),
    })
    .array();

const preCommitReposSchema = z.looseObject({ hooks: preCommitHooksSchema.catch([]) }).array();

export const preCommitConfigSchema = z.looseObject({ repos: preCommitReposSchema.catch([]) });

export const lintCommandPackageSchema = z.looseObject({
    scripts: stringValuesSchema.catch({}),
    devDependencies: stringValuesSchema.catch({}),
    'lint-staged': stringListSchema.catch([]),
    'simple-git-hooks': stringValuesSchema.catch({}),
});
