import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/checks/naming.ts';
import { regexSchema, pathContainerSchema } from '#cli/schemas/configurations/parts.ts';
import type { NamedCategory, NamingDefaults, NamingOverride } from '#cli/types/checks/naming.ts';

const identifierCategory = z.enum(NAMED_CATEGORIES) satisfies z.ZodType<NamedCategory>;

const reservedCategories = z
    .array(identifierCategory)
    .min(1)
    .meta({ description: 'Identifier categories where the term is permitted, such as properties or folders.' });

const namingGroupSchema = z.strictObject({ terms: z.array(z.string()) } satisfies SchemaShape<
    NamingDefaults['groups'][string]
>);

/** A path-specific naming override shared by settings, manifests, and shipped naming data. */
export const namingOverrideSchema = z.strictObject({
    paths: z
        .array(z.string().min(1).meta({ pathRole: 'source' }))
        .min(1)
        .optional()
        .meta({ description: 'Where the override applies.' }),
    languages: z.array(z.string()).optional().meta({ description: 'The languages it applies to.' }),
    categories: z
        .array(identifierCategory)
        .optional()
        .meta({ description: 'The kinds of name it applies to. Unknown kinds are refused.' }),
    ignored_prefix: z.string().optional().meta({ description: 'A prefix not counted as a word, such as ^test_.' }),
    ignored_names_pattern: regexSchema.optional().meta({
        description: 'A regular expression for names that skip the naming rules, such as ^__[a-z][a-z0-9_]*__$.',
    }),
    allow_digits: z.boolean().optional().meta({ description: 'Accept digits in names.' }),
    allow_repeated_words: z.boolean().optional().meta({ description: 'Accept a word twice in one name.' }),
    allowed_names: z.array(z.string()).optional().meta({ description: 'Names accepted despite the naming rules.' }),
    cases: z.array(z.enum(CASE_NAMES)).optional().meta({ description: 'The cases accepted here.' }),
    reason: z.string().optional().meta({ description: 'Why these names may break the rules.' }),
} satisfies SchemaShape<NamingOverride>);

/** Naming exceptions shipped by a configuration or the default naming data always state their reason. */
export const declaredNamingOverrideSchema = namingOverrideSchema.extend({
    reason: z.string().min(1),
}) satisfies z.ZodType<NamingOverride>;

/** Shipped naming defaults for validation and source checks. */
export const namingDefaultsSchema = z.strictObject({
    path_containers: z.array(pathContainerSchema),
    allow_digits: z.boolean(),
    allow_repeated_words: z.boolean(),
    groups: z
        .object({ folders: namingGroupSchema } satisfies SchemaShape<{ folders: NamingDefaults['groups'][string] }>)
        .catchall(namingGroupSchema),
    reserved: z.record(z.string(), reservedCategories),
    allowed_names: z.array(z.string()),
    allowed_phrases: z.array(z.string()),
    languages: z.record(
        z.string(),
        z.strictObject({
            categories: z.record(
                z.string(),
                z.strictObject({ cases: z.array(z.enum(CASE_NAMES)) } satisfies SchemaShape<
                    NamingDefaults['languages'][string]['categories'][string]
                >),
            ),
        } satisfies SchemaShape<NamingDefaults['languages'][string]>),
    ),
    override: z.array(declaredNamingOverrideSchema),
} satisfies SchemaShape<NamingDefaults>);
