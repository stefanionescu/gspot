import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import { pathContainerSchema } from '#cli/configurations/schema/parts.ts';
import type { NamedCategory, NamingDefaults, NamingOverride } from '#cli/types/checks/general.ts';
import { CASE_NAMES, ACRONYM_STYLES, NAMED_CATEGORIES } from '#cli/config/checks/general/naming.ts';

const identifierCategory = z.enum(NAMED_CATEGORIES) satisfies z.ZodType<NamedCategory>;

const reservedCategories = z
    .array(identifierCategory)
    .min(1)
    .meta({ description: 'Identifier categories where the term is permitted, such as properties or directories.' });

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
    allow_digits: z.boolean().optional().meta({ description: 'Accept digits in names.' }),
    allow_repeated_words: z.boolean().optional().meta({ description: 'Accept a word twice in one name.' }),
    allowed_names: z.array(z.string()).optional().meta({ description: 'Names accepted despite the naming rules.' }),
    cases: z.array(z.enum(CASE_NAMES)).optional().meta({ description: 'The cases accepted here.' }),
    reason: z.string().optional().meta({ description: 'Why these names may break the rules.' }),
} satisfies SchemaShape<NamingOverride>);

/** Built-in naming defaults read by validation and source checks. */
export const namingDefaultsSchema = z.strictObject({
    path_containers: z.array(pathContainerSchema),
    allow_digits: z.boolean(),
    allow_repeated_words: z.boolean(),
    groups: z
        .object({ folders: namingGroupSchema } satisfies SchemaShape<{ folders: NamingDefaults['groups'][string] }>)
        .catchall(namingGroupSchema),
    reserved: z.record(z.string(), reservedCategories),
    allowed_names: z.array(z.string()),
    languages: z.record(
        z.string(),
        z.strictObject({
            acronyms: z.enum(ACRONYM_STYLES),
            categories: z.record(
                z.string(),
                z.strictObject({ cases: z.array(z.enum(CASE_NAMES)) } satisfies SchemaShape<
                    NamingDefaults['languages'][string]['categories'][string]
                >),
            ),
        } satisfies SchemaShape<NamingDefaults['languages'][string]>),
    ),
    override: z.array(namingOverrideSchema),
} satisfies SchemaShape<NamingDefaults>);
