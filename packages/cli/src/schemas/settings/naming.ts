import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { namingOverrideSchema } from '#cli/schemas/configurations/naming.ts';
import { nonemptyPaths, namingCategorySchema } from '#cli/schemas/settings/parts.ts';
import { type TableSettings, type NamingCategory, type SettingLanguage } from '#cli/types/settings/tables.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/schema.ts';
import { type WrittenNaming, type ParsedNamingOverride, type WrittenNamingOverride } from '#cli/types/settings/file.ts';

const namingLanguageSchema = namingCategorySchema.extend(
    Object.fromEntries(
        NAMING_TABLE_CATEGORIES.map((category) => [category, namingCategorySchema.optional()]),
    ) as Record<NamingCategory, z.ZodOptional<typeof namingCategorySchema>>,
);

const namingLanguages = Object.fromEntries(
    Object.entries(NAMING_LANGUAGE_CATEGORIES).map(([language, categories]) => [
        language,
        namingLanguageSchema.pick(
            Object.fromEntries(
                [...Object.keys(namingCategorySchema.shape), ...categories].map((name) => [name, true]),
            ) as Record<keyof typeof namingLanguageSchema.shape, true>,
        ),
    ]),
) as Record<SettingLanguage, typeof namingLanguageSchema>;

namingLanguageSchema.register(z.globalRegistry, { id: 'namingLanguage' });

const namingLists = {
    banned_words: z
        .array(z.string())
        .default(SETTING_DECLARATIONS['naming.banned_words'].default)
        .meta(SETTING_DECLARATIONS['naming.banned_words']),
    override: z
        .array(
            namingOverrideSchema.extend({
                paths: nonemptyPaths
                    .default(SETTING_DECLARATIONS['naming.override.paths'].default)
                    .describe(namingOverrideSchema.shape.paths.description as string),
                languages: z
                    .array(z.enum(SETTING_LANGUAGES))
                    .optional()
                    .describe(namingOverrideSchema.shape.languages.description as string),
                allow_digits: namingOverrideSchema.shape.allow_digits.default(
                    SETTING_DECLARATIONS['naming.override.allow_digits'].default,
                ),
                allow_repeated_words: namingOverrideSchema.shape.allow_repeated_words.default(
                    SETTING_DECLARATIONS['naming.override.allow_repeated_words'].default,
                ),
                reason: z.string().describe(namingOverrideSchema.shape.reason.description as string),
            } satisfies SchemaShape<
                Pick<ParsedNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>,
                Pick<WrittenNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>
            >),
        )
        .default(SETTING_DECLARATIONS['naming.override'].default)
        .meta(SETTING_DECLARATIONS['naming.override']),
};

const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...namingLists,
    typescript: namingLanguages['typescript'].optional(),
    javascript: namingLanguages['javascript'].optional(),
    python: namingLanguages['python'].optional(),
    swift: namingLanguages['swift'].optional(),
    bash: namingLanguages['bash'].optional(),
    sql: namingLanguages['sql'].optional(),
    css: namingLanguages['css'].optional(),
    html: namingLanguages['html'].optional(),
} satisfies SchemaShape<TableSettings<'naming'>, WrittenNaming>);

export { namingSchema };
