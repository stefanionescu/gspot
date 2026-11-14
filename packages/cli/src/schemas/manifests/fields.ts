import { z } from 'zod';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects.ts';
import { LEVELS, CASE_NAMES, NAMED_CATEGORIES, VALID_UNICODE_MESSAGE } from '#cli/config/manifests.ts';

export const nonemptyStringSchema = z.string().min(1);

export const regexSchema = z.string().refine((pattern) => {
    try {
        return new RegExp(pattern, 'u').unicode;
    } catch {
        return false;
    }
}, VALID_UNICODE_MESSAGE);

export const levelSchema = z.enum(LEVELS);

export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

export const conditionSchema = z.strictObject({
    configuration: z.string().min(1),
    config_file: z.string().min(1),
    level: levelSchema,
    setting: z.string().min(1),
    dependencies: z.string().min(1).array().min(1),
    absent_dependencies: z.string().min(1).array().min(1),
    filenames: z.string().min(1).array().min(1),
    tags: z.string().min(1).array().min(1),
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().min(1),
});

export const identifierCategorySchema = z.enum(NAMED_CATEGORIES);

const sourcePathSchema = z.string().min(1);

export const namingExceptionSchema = z.strictObject({
    paths: sourcePathSchema.array().min(1).optional().meta({ description: 'Where the exception applies.' }),
    languages: z.string().array().optional().meta({ description: 'The languages it applies to.' }),
    categories: identifierCategorySchema
        .array()
        .optional()
        .meta({ description: 'The kinds of name it applies to. Unknown kinds are refused.' }),
    ignored_prefix: z.string().optional().meta({ description: 'A prefix not counted as a word, such as ^test_.' }),
    ignored_names_pattern: regexSchema.optional().meta({
        description: 'A regular expression for names that skip the naming rules, such as ^__[a-z][a-z0-9_]*__$.',
    }),
    allow_digits: z.boolean().optional().meta({ description: 'Accept digits in names.' }),
    allow_repeated_words: z.boolean().optional().meta({ description: 'Accept a word twice in one name.' }),
    allowed_names: z.string().array().optional().meta({ description: 'Names accepted despite the naming rules.' }),
    cases: z.enum(CASE_NAMES).array().optional().meta({ description: 'The cases accepted here.' }),
    reason: z.string().optional().meta({ description: 'Why these names may break the rules.' }),
});

export const writtenNamingExceptionSchema = namingExceptionSchema.extend({
    reason: z.string().min(1),
});
