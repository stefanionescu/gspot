import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { namingOverrideSchema } from '#cli/configurations/schema/naming.ts';
import { nonemptyPaths, namingCategorySchema } from '#cli/settings/schema/parts.ts';
import { type TableSettings, type NamingCategory } from '#cli/types/settings/tables.ts';
import { type WrittenNaming, type ParsedNamingOverride, type WrittenNamingOverride } from '#cli/types/settings/file.ts';

// Each language table accepts the categories that its name reader reports, as NAMING_LANGUAGE_CATEGORIES lists them.
const pathCategories = {
    files: namingCategorySchema.optional(),
    folders: namingCategorySchema.optional(),
};

const namingLanguageSchema = namingCategorySchema.extend({
    ...pathCategories,
    types: namingCategorySchema.optional(),
    functions: namingCategorySchema.optional(),
    parameters: namingCategorySchema.optional(),
    variables: namingCategorySchema.optional(),
    properties: namingCategorySchema.optional(),
} satisfies SchemaShape<
    Pick<NonNullable<TableSettings<'naming'>['typescript']>, NamingCategory>,
    Pick<NonNullable<WrittenNaming['typescript']>, NamingCategory>
>);

const bashNamingSchema = namingCategorySchema.extend({
    ...pathCategories,
    functions: namingCategorySchema.optional(),
    variables: namingCategorySchema.optional(),
});

const sqlNamingSchema = namingCategorySchema.extend({
    ...pathCategories,
    functions: namingCategorySchema.optional(),
    parameters: namingCategorySchema.optional(),
});

const pathNamingSchema = namingCategorySchema.extend(pathCategories);

namingLanguageSchema.register(z.globalRegistry, { id: 'namingLanguage' });

const namingLists = {
    banned_words: z.array(z.string()).default([]).meta(SETTING_DECLARATIONS['naming.banned_words']),
    override: z
        .array(
            namingOverrideSchema.extend({
                paths: nonemptyPaths.default(['**']).describe(namingOverrideSchema.shape.paths.description as string),
                languages: z
                    .array(z.enum(SETTING_LANGUAGES))
                    .optional()
                    .describe(namingOverrideSchema.shape.languages.description as string),
                allow_digits: namingOverrideSchema.shape.allow_digits.default(false),
                allow_repeated_words: namingOverrideSchema.shape.allow_repeated_words.default(false),
                reason: z.string().describe(namingOverrideSchema.shape.reason.description as string),
            } satisfies SchemaShape<
                Pick<ParsedNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>,
                Pick<WrittenNamingOverride, 'paths' | 'languages' | 'allow_digits' | 'allow_repeated_words' | 'reason'>
            >),
        )
        .default([])
        .meta(SETTING_DECLARATIONS['naming.override']),
};

const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...namingLists,
    typescript: namingLanguageSchema.optional(),
    javascript: namingLanguageSchema.optional(),
    python: namingLanguageSchema.optional(),
    swift: namingLanguageSchema.optional(),
    bash: bashNamingSchema.optional(),
    sql: sqlNamingSchema.optional(),
    css: pathNamingSchema.optional(),
    html: pathNamingSchema.optional(),
} satisfies SchemaShape<TableSettings<'naming'>, WrittenNaming>);

export { namingSchema };
