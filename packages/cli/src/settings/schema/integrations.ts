import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { CI_PROVIDERS } from '#cli/config/settings/schema.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { type ParsedRules } from '#cli/types/settings/tables.ts';
import { type WrittenSettings } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { commandSchema, operatingSystemSchema } from '#cli/configurations/schema/parts.ts';

const rulesSchema = z.strictObject({
    enabled: z.boolean().default(true).meta({
        description: 'Write the rules and the AGENTS.md block.',
    }),
    exclude: z.array(z.string()).default([]).meta({
        description:
            'Rule files or folders under .gspot/configurations/ to leave out, such as .gspot/configurations/general/engineering/rules/PLANNING.md.',
    }),
} satisfies SchemaShape<ParsedRules, NonNullable<WrittenSettings['rules']>>);

const hooksSchema = z.strictObject({
    enabled: z.boolean().default(false).describe('Install and run the configured Git hooks.'),
} satisfies SchemaShape<NonNullable<Settings['hooks']>, NonNullable<WrittenSettings['hooks']>>);

const ciFields = {
    enabled: z.boolean().default(false).describe(SETTING_DECLARATIONS['ci.enabled'].description),
    provider: z.enum(CI_PROVIDERS).default('github').describe(SETTING_DECLARATIONS['ci.provider'].description),
    setup_command: commandSchema.optional().describe(SETTING_DECLARATIONS['ci.setup_command'].description),
    operating_systems: z
        .array(operatingSystemSchema)
        .min(1)
        .default(['linux'])
        .describe('The operating systems of the CI jobs. GitHub only; refused with provider = "gitlab".'),
} satisfies SchemaShape<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;

const ciSchema = z
    .strictObject({
        ...ciFields,
        operating_systems: ciFields.operating_systems
            .unwrap()
            .optional()
            .meta({
                description: ciFields.operating_systems.description,
                default: ciFields.operating_systems.parse(undefined),
            }),
    } satisfies SchemaShape<
        Omit<NonNullable<Settings['ci']>, 'operating_systems'> &
            Pick<NonNullable<WrittenSettings['ci']>, 'operating_systems'>,
        NonNullable<WrittenSettings['ci']>
    >)
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
                if: { properties: { provider: { const: 'gitlab' } }, required: ['provider'] },
                // eslint-disable-next-line unicorn/no-thenable -- reason: JSON Schema defines this conditional keyword.
                then: { not: { required: ['operating_systems'] } },
            },
        ],
    }) satisfies z.ZodType<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;

export { ciFields, ciSchema, rulesSchema, hooksSchema };
