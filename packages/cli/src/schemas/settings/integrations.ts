import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { CI_PROVIDERS } from '#cli/config/settings/schema.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { type ParsedRules } from '#cli/types/settings/tables.ts';
import { type WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { commandSchema, operatingSystemSchema } from '#cli/schemas/configurations/parts.ts';

const rulesSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DECLARATIONS['rules.enabled'].default)
        .meta(SETTING_DECLARATIONS['rules.enabled']),
    exclude: z
        .array(z.string())
        .default(SETTING_DECLARATIONS['rules.exclude'].default)
        .meta(SETTING_DECLARATIONS['rules.exclude']),
} satisfies SchemaShape<ParsedRules, NonNullable<WrittenSettings['rules']>>);

const hooksSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DECLARATIONS['hooks.enabled'].default)
        .meta(SETTING_DECLARATIONS['hooks.enabled']),
} satisfies SchemaShape<NonNullable<Settings['hooks']>, NonNullable<WrittenSettings['hooks']>>);

const ciFields = {
    enabled: z
        .boolean()
        .default(SETTING_DECLARATIONS['ci.enabled'].default)
        .describe(SETTING_DECLARATIONS['ci.enabled'].description),
    provider: z
        .enum(CI_PROVIDERS)
        .default(SETTING_DECLARATIONS['ci.provider'].default)
        .describe(SETTING_DECLARATIONS['ci.provider'].description),
    setup_command: commandSchema.optional().describe(SETTING_DECLARATIONS['ci.setup_command'].description),
    operating_systems: z
        .array(operatingSystemSchema)
        .min(1)
        .default(SETTING_DECLARATIONS['ci.operating_systems'].default)
        .meta(SETTING_DECLARATIONS['ci.operating_systems']),
} satisfies SchemaShape<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;

const ciSchema = z
    .strictObject({
        ...ciFields,
        operating_systems: ciFields.operating_systems
            .unwrap()
            .optional()
            .meta(SETTING_DECLARATIONS['ci.operating_systems']),
    })
    .superRefine((ci, context) => {
        if (ci.provider === 'gitlab' && ci.operating_systems !== undefined)
            context.addIssue({
                code: 'custom',
                path: ['operating_systems'],
                message: 'ci.operating_systems is GitHub only. Remove it when ci.provider is "gitlab".',
            });
    })
    .transform((ci) => ({
        ...ci,
        operating_systems: ci.operating_systems ?? ciFields.operating_systems.parse(undefined),
    }))
    .meta({
        allOf: [
            {
                if: { type: 'object', properties: { provider: { const: 'gitlab' } }, required: ['provider'] },
                // eslint-disable-next-line unicorn/no-thenable -- reason: JSON Schema defines this conditional keyword.
                then: { type: 'object', properties: { operating_systems: false } },
            },
        ],
    }) satisfies z.ZodType<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;

export { ciFields, ciSchema, rulesSchema, hooksSchema };
