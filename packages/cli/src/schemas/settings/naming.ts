import { z } from 'zod';
import { namingOverrideSchema } from '#cli/schemas/configurations/naming.ts';
import type { NamingCategory, SettingLanguage } from '#cli/types/settings/naming.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { nonemptyPathsSchema, namingCategorySchema } from '#cli/schemas/settings/fields.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';

const languageSchema = namingCategorySchema.extend(
    Object.fromEntries(
        NAMING_TABLE_CATEGORIES.map((category) => [
            category,
            namingCategorySchema.optional().describe(`Naming rules for ${category}.`),
        ]),
    ) as Record<NamingCategory, z.ZodOptional<typeof namingCategorySchema>>,
);

const languageSchemas = Object.fromEntries(
    Object.entries(NAMING_LANGUAGE_CATEGORIES).map(([language, categories]) => [
        language,
        languageSchema
            .pick(
                Object.fromEntries(
                    [...Object.keys(namingCategorySchema.shape), ...categories].map((name) => [name, true]),
                ) as Record<keyof typeof languageSchema.shape, true>,
            )
            .describe(`Naming rules for ${language} files, folders, and identifiers.`),
    ]),
) as Record<SettingLanguage, typeof languageSchema>;

languageSchema.register(z.globalRegistry, { id: 'namingLanguage' });

const lists = {
    banned_words: z
        .string()
        .array()
        .default(SETTING_DEFINITIONS['naming.banned_words'].default)
        .meta(SETTING_DEFINITIONS['naming.banned_words']),
    override: namingOverrideSchema
        .extend({
            paths: nonemptyPathsSchema
                .default(SETTING_DEFINITIONS['naming.override.paths'].default)
                .describe(namingOverrideSchema.shape.paths.description as string),
            languages: z
                .enum(SETTING_LANGUAGES)
                .array()
                .optional()
                .describe(namingOverrideSchema.shape.languages.description as string),
            allow_digits: namingOverrideSchema.shape.allow_digits.default(
                SETTING_DEFINITIONS['naming.override.allow_digits'].default,
            ),
            allow_repeated_words: namingOverrideSchema.shape.allow_repeated_words.default(
                SETTING_DEFINITIONS['naming.override.allow_repeated_words'].default,
            ),
            reason: z.string().describe(namingOverrideSchema.shape.reason.description as string),
        })
        .array()
        .default(SETTING_DEFINITIONS['naming.override'].default)
        .meta(SETTING_DEFINITIONS['naming.override']),
};

export const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...lists,
    typescript: languageSchemas['typescript'].optional(),
    javascript: languageSchemas['javascript'].optional(),
    python: languageSchemas['python'].optional(),
    swift: languageSchemas['swift'].optional(),
    bash: languageSchemas['bash'].optional(),
    sql: languageSchemas['sql'].optional(),
    css: languageSchemas['css'].optional(),
    html: languageSchemas['html'].optional(),
});
