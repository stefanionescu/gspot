import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { Settings, WrittenSettings } from '#cli/types/settings/file.ts';
import { CI_PROVIDERS, GITHUB_ONLY_CI_KEYS } from '#cli/config/settings/ci.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { commandSchema, operatingSystemSchema } from '#cli/schemas/configurations/fields.ts';

export const ciFields = {
    enabled: z.boolean().default(SETTING_DEFINITIONS['ci.enabled'].default).meta(SETTING_DEFINITIONS['ci.enabled']),
    provider: z
        .enum(CI_PROVIDERS)
        .default(SETTING_DEFINITIONS['ci.provider'].default)
        .meta(SETTING_DEFINITIONS['ci.provider']),
    setup_command: commandSchema.optional().meta(SETTING_DEFINITIONS['ci.setup_command']),
    operating_systems: operatingSystemSchema
        .array()
        .min(1)
        .default(SETTING_DEFINITIONS['ci.operating_systems'].default)
        .meta(SETTING_DEFINITIONS['ci.operating_systems']),
    linux_runner: z
        .string()
        .min(1)
        .default(SETTING_DEFINITIONS['ci.linux_runner'].default)
        .meta(SETTING_DEFINITIONS['ci.linux_runner']),
} satisfies SchemaShape<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;

export const ciSchema = z
    .strictObject({
        ...ciFields,
        operating_systems: ciFields.operating_systems
            .unwrap()
            .optional()
            .meta(SETTING_DEFINITIONS['ci.operating_systems']),
        linux_runner: ciFields.linux_runner.unwrap().optional().meta(SETTING_DEFINITIONS['ci.linux_runner']),
    })
    .superRefine((ci, context) => {
        for (const key of GITHUB_ONLY_CI_KEYS)
            if (ci.provider === 'gitlab' && ci[key] !== undefined)
                context.addIssue({
                    code: 'custom',
                    path: [key],
                    message: `ci.${key} is GitHub only. Remove it when ci.provider is "gitlab".`,
                });
    })
    .transform((ci) => ({
        ...ci,
        operating_systems: ci.operating_systems ?? ciFields.operating_systems.parse(undefined),
        linux_runner: ci.linux_runner ?? ciFields.linux_runner.parse(undefined),
    }))
    .meta({
        allOf: [
            {
                if: { type: 'object', properties: { provider: { const: 'gitlab' } }, required: ['provider'] },
                // eslint-disable-next-line unicorn/no-thenable -- reason: JSON Schema defines this conditional keyword.
                then: { type: 'object', properties: { operating_systems: false, linux_runner: false } },
            },
        ],
    }) satisfies z.ZodType<NonNullable<Settings['ci']>, NonNullable<WrittenSettings['ci']>>;
