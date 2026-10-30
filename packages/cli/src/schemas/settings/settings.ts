import { z } from 'zod';
import semver from 'semver';
import { isTable } from '#cli/system/tables.ts';
import parseExpression from 'spdx-expression-parse';
import { namingOverrideSchema } from '#cli/schemas/manifests/manifests.ts';
import type { ImportRule, SettingsError } from '#cli/types/settings/settings.ts';
import { CI_PROVIDERS, GITHUB_ONLY_CI_KEYS } from '#cli/config/settings/settings.ts';
import type { NamingCategory, SettingLanguage } from '#cli/types/settings/naming.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { commandSchema, nonemptyStringSchema, operatingSystemSchema } from '#cli/schemas/manifests/fields.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';

import {
    relativePathSchema,
    allowReasonedValue,
    nonemptyPathsSchema,
    namingCategorySchema,
} from '#cli/schemas/settings/fields.ts';

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
};

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
    });

export const hooksSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DEFINITIONS['hooks.enabled'].default)
        .meta(SETTING_DEFINITIONS['hooks.enabled']),
});

const importRuleSchema = z.strictObject({
    name: z.string().min(1).meta(SETTING_DEFINITIONS['import_rule.name']),
    paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['import_rule.paths']),
    can_import: z.string().array().optional().meta(SETTING_DEFINITIONS['import_rule.can_import']),
});

function validateImportRules(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) =>
        (rule.can_import ?? []).flatMap((name, edge) =>
            names.has(name)
                ? []
                : { path: [index, 'can_import', edge], message: `There is no import rule called ${name}.` },
        ),
    );
}

export const importRulesSchema = importRuleSchema
    .array()
    .superRefine((rules, context) => {
        for (const { path, message } of validateImportRules(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default(SETTING_DEFINITIONS['import_rule'].default)
    .meta(SETTING_DEFINITIONS['import_rule']);

export const javascriptSchema = z
    .strictObject({
        script_files: allowReasonedValue(relativePathSchema.array(), SETTING_DEFINITIONS['javascript.script_files']),
        import_boundaries: relativePathSchema
            .array()
            .default(SETTING_DEFINITIONS['javascript.import_boundaries'].default)
            .meta(SETTING_DEFINITIONS['javascript.import_boundaries']),
        externals: allowReasonedValue(z.string().min(1).array(), SETTING_DEFINITIONS['javascript.externals']),
    })
    .optional();

export const pythonSchema = z
    .strictObject({
        externals: allowReasonedValue(z.string().min(1).array(), SETTING_DEFINITIONS['python.externals']),
        import_folders: relativePathSchema
            .array()
            .default(SETTING_DEFINITIONS['python.import_folders'].default)
            .meta(SETTING_DEFINITIONS['python.import_folders']),
    })
    .optional();

const allowedPackageSchema = z.strictObject({
    name: nonemptyStringSchema.meta(SETTING_DEFINITIONS['licenses.allowed_package.name']),
    version: z
        .string()
        .refine(
            (range) => semver.validRange(range) !== null,
            'Name an exact version, a semver range such as ^1.2.0, or * for every version.',
        )
        .meta(SETTING_DEFINITIONS['licenses.allowed_package.version']),
    reason: z.string().meta(SETTING_DEFINITIONS['licenses.allowed_package.reason']),
});

export const licensesSchema = z.strictObject({
    allowed: nonemptyStringSchema
        .refine((id) => {
            try {
                const expression = parseExpression(id);
                return isTable(expression) && 'license' in expression;
            } catch {
                return false;
            }
        }, 'Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.')
        .array()
        .default(SETTING_DEFINITIONS['licenses.allowed'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed']),
    allowed_package: allowedPackageSchema
        .array()
        .default(SETTING_DEFINITIONS['licenses.allowed_package'].default)
        .meta(SETTING_DEFINITIONS['licenses.allowed_package']),
});

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

export const rulesSchema = z.strictObject({
    enabled: z
        .boolean()
        .default(SETTING_DEFINITIONS['rules.enabled'].default)
        .meta(SETTING_DEFINITIONS['rules.enabled']),
    exclude: z
        .string()
        .array()
        .default(SETTING_DEFINITIONS['rules.exclude'].default)
        .meta(SETTING_DEFINITIONS['rules.exclude']),
});
