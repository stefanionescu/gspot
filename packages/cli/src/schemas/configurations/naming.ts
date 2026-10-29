import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import { regexSchema } from '#cli/schemas/configurations/fields.ts';
import { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/configurations/naming.ts';
import type { PathContainer, NamingDefaults, NamingOverride } from '#cli/types/configurations.ts';

const pathContainerSchema = z.strictObject({
    open: z.string().min(1),
    close: z.string(),
    category: z.enum(NAMED_CATEGORIES),
} satisfies SchemaShape<PathContainer>);

const identifierCategorySchema = z.enum(NAMED_CATEGORIES) satisfies z.ZodType<NamedCategory>;

const sourcePathSchema = z.string().min(1).meta({ pathRole: 'source' }) satisfies z.ZodType<string>;

const wordListSchema = z.strictObject({ words: z.string().array() } satisfies SchemaShape<
    NamingDefaults['lists'][string]
>);

export const namingOverrideSchema = z.strictObject({
    paths: sourcePathSchema.array().min(1).optional().meta({ description: 'Where the override applies.' }),
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
} satisfies SchemaShape<NamingOverride>);

export const writtenNamingOverrideSchema = namingOverrideSchema.extend({
    reason: z.string().min(1),
}) satisfies z.ZodType<NamingOverride>;

const categoryCasesSchema = z.strictObject({ cases: z.enum(CASE_NAMES).array() } satisfies SchemaShape<
    NamingDefaults['languages'][string]['categories'][string]
>);

const languageSchema = z.strictObject({
    categories: z.record(z.string(), categoryCasesSchema),
} satisfies SchemaShape<NamingDefaults['languages'][string]>);

export const namingDefaultsSchema = z.strictObject({
    path_containers: pathContainerSchema.array(),
    lists: z
        .object({ folders: wordListSchema } satisfies SchemaShape<{ folders: NamingDefaults['lists'][string] }>)
        .catchall(wordListSchema),
    allowed_names: z.string().array(),
    allowed_phrases: z.string().array(),
    languages: z.record(z.string(), languageSchema),
    override: writtenNamingOverrideSchema.array(),
} satisfies SchemaShape<NamingDefaults>);
