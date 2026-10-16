import { z } from 'zod';
import { type SchemaShape } from '#cli/types/objects.ts';
import { DEFAULT_FIELDS } from '#cli/config/settings/defaults.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';
import { namingOverrideSchema } from '#cli/configurations/schema/naming.ts';
import { nonemptyPaths, namingCategorySchema } from '#cli/settings/schema/parts.ts';
import { type TableSettings, type NamingCategory, type NamingLanguage } from '#cli/types/settings/tables.ts';
import { type WrittenNaming, type ParsedNamingOverride, type WrittenNamingOverride } from '#cli/types/settings/file.ts';

const namingLanguageSchema = namingCategorySchema.extend({
    files: namingCategorySchema.optional(),
    directories: namingCategorySchema.optional(),
    types: namingCategorySchema.optional(),
    functions: namingCategorySchema.optional(),
    parameters: namingCategorySchema.optional(),
    variables: namingCategorySchema.optional(),
    properties: namingCategorySchema.optional(),
} satisfies SchemaShape<
    Pick<NonNullable<TableSettings<'naming'>[NamingLanguage]>, NamingCategory>,
    Pick<NonNullable<WrittenNaming[NamingLanguage]>, NamingCategory>
>);

const namingLists = {
    banned_words: z.array(z.string()).default([]).meta(DEFAULT_FIELDS.banned_words),
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
        .meta(DEFAULT_FIELDS.override),
};

const namingSchema = z.strictObject({
    ...namingCategorySchema.shape,
    ...namingLists,
    typescript: namingLanguageSchema.optional(),
    javascript: namingLanguageSchema.optional(),
    python: namingLanguageSchema.optional(),
    bash: namingLanguageSchema.optional(),
    swift: namingLanguageSchema.optional(),
    sql: namingLanguageSchema.optional(),
    css: namingLanguageSchema.optional(),
    html: namingLanguageSchema.optional(),
} satisfies SchemaShape<TableSettings<'naming'>, WrittenNaming>);

export { namingSchema };
