import { z } from 'zod';
import { ciSchema } from '#cli/schemas/settings/ci.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { hooksSchema } from '#cli/schemas/settings/hooks.ts';
import { rulesSchema } from '#cli/schemas/settings/rules.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { TABLE_DESCRIPTIONS } from '#cli/config/settings/json-schema.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { levelSchema, commandCheckFields } from '#cli/schemas/configurations/fields.ts';
import { toolsSchema as publicToolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import type { WrittenScope, ParsedSettings, WrittenSettings } from '#cli/types/settings/file.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, UNSAFE_CHARACTERS, RESERVED_SEGMENTS } from '#cli/config/system/files/names.ts';

import {
    formatSchema,
    localDateSchema,
    relativePathSchema,
    nonemptyPathsSchema,
    removedConfigurationsSchema,
} from '#cli/schemas/settings/fields.ts';
import {
    COMMAND_CHECK_ID,
    GSPOT_FOLDER_PATH,
    SETTINGS_EXAMPLES,
    SCOPE_PATH_MESSAGES,
    NAMED_FINDING_CHECKS,
    NO_CHECK_RULE_MESSAGE,
    NO_CHECK_PATHS_MESSAGE,
} from '#cli/config/settings/file.ts';

export const ignoreSchema = z
    .strictObject({
        check: z.string().optional().meta(SETTING_DEFINITIONS['ignore.check']),
        rule: z.string().optional().meta(SETTING_DEFINITIONS['ignore.rule']),
        names: z.string().min(1).array().min(1).optional().meta(SETTING_DEFINITIONS['ignore.names']),
        paths: nonemptyPathsSchema.optional().meta(SETTING_DEFINITIONS['ignore.paths']),
        reason: z
            .string({ error: 'needs a reason. Add reason = "..." to this record.' })
            .meta(SETTING_DEFINITIONS['ignore.reason']),
        until: localDateSchema.optional().meta(SETTING_DEFINITIONS['ignore.until']),
    } satisfies SchemaShape<
        NonNullable<ParsedSettings['ignore']>[number],
        NonNullable<WrittenSettings['ignore']>[number]
    >)
    .superRefine((ignore, context) => {
        if (ignore.names !== undefined && !NAMED_FINDING_CHECKS.has(ignore.check ?? ''))
            context.addIssue({
                code: 'custom',
                path: ['names'],
                message: `names applies only to ${new Intl.ListFormat('en', { type: 'conjunction' }).format(NAMED_FINDING_CHECKS)}, whose findings name a definition.`,
            });
    })
    .superRefine((ignore, context) => {
        if (ignore.check !== undefined) {
            return;
        }
        if (ignore.paths === undefined)
            context.addIssue({ code: 'custom', path: ['paths'], message: NO_CHECK_PATHS_MESSAGE });
        if (ignore.rule !== undefined)
            context.addIssue({
                code: 'custom',
                path: ['rule'],
                message: NO_CHECK_RULE_MESSAGE,
            });
    });

export const commandCheckSchema = z.strictObject({
    id: z
        .string()
        .regex(COMMAND_CHECK_ID, 'Use a check ID without whitespace or commas.')
        .meta(SETTING_DEFINITIONS['command_check.id']),
    command: commandCheckFields.command.unwrap().meta(SETTING_DEFINITIONS['command_check.command']),
    paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['command_check.paths']),
    outputs: nonemptyPathsSchema.optional().meta(SETTING_DEFINITIONS['command_check.outputs']),
    stage: commandCheckFields.stage.exclude(['message']).meta(SETTING_DEFINITIONS['command_check.stage']),
    summary: commandCheckFields.summary.meta(SETTING_DEFINITIONS['command_check.summary']),
    help: commandCheckFields.help.meta(SETTING_DEFINITIONS['command_check.help']),
    fix: commandCheckFields.fix.meta(SETTING_DEFINITIONS['command_check.fix']),
    exit_codes: commandCheckFields.exit_codes.meta(SETTING_DEFINITIONS['command_check.exit_codes']),
    output: commandCheckFields.output.meta(SETTING_DEFINITIONS['command_check.output']),
} satisfies SchemaShape<
    NonNullable<ParsedSettings['command_check']>[number],
    NonNullable<WrittenSettings['command_check']>[number]
>);

const { structure: rootStructure, ...scopeTables } = configurationTableSchemas;

const rootBody = {
    ...scopeTables,
    tools: publicToolsSchema.optional(),
};

const scopeBody = {
    ...rootBody,
    dependencies: configurationTableSchemas.dependencies
        .unwrap()
        .omit({ min_release_age_days: true })
        .optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['dependencies'],
        WrittenScope['dependencies']
    >,
    prose: configurationTableSchemas.prose.unwrap().omit({ banned_headings: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['prose'],
        WrittenScope['prose']
    >,
    coverage: z
        .strictObject({
            lines: configurationTableSchemas.coverage.unwrap().shape.lines,
            branches: configurationTableSchemas.coverage.unwrap().shape.branches,
            functions: configurationTableSchemas.coverage.unwrap().shape.functions,
            statements: configurationTableSchemas.coverage.unwrap().shape.statements,
        } satisfies SchemaShape<
            NonNullable<NonNullable<ParsedSettings['scope']>[number]['coverage']>,
            NonNullable<WrittenScope['coverage']>
        >)
        .optional(),
    licenses: configurationTableSchemas.licenses
        .unwrap()
        .omit({ allowed_package: true })
        .optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['licenses'],
        WrittenScope['licenses']
    >,
    site: configurationTableSchemas.site.unwrap().omit({ size_limit: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['site'],
        WrittenScope['site']
    >,
    naming: namingSchema.omit({ override: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['naming'],
        WrittenScope['naming']
    >,
    structure: rootStructure.unwrap().pick({ environment_readers: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['structure'],
        WrittenScope['structure']
    >,
    format: formatSchema.omit({ override: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['format'],
        WrittenScope['format']
    >,
    tools: (
        publicToolsSchema.omit({ v8r: true }) satisfies z.ZodType<
            Omit<NonNullable<ParsedSettings['tools']>, 'v8r'>,
            Omit<NonNullable<WrittenSettings['tools']>, 'v8r'>
        >
    )
        .extend({
            eslint: publicToolsSchema.shape.eslint
                .unwrap()
                .omit({ override: true })
                .optional()
                .describe(publicToolsSchema.shape.eslint.description as string) satisfies z.ZodType<
                NonNullable<NonNullable<ParsedSettings['scope']>[number]['tools']>['eslint'],
                NonNullable<WrittenScope['tools']>['eslint']
            >,
        } satisfies SchemaShape<
            Pick<NonNullable<NonNullable<ParsedSettings['scope']>[number]['tools']>, 'eslint'>,
            Pick<NonNullable<WrittenScope['tools']>, 'eslint'>
        >)
        .optional(),
};

for (const [name, schema] of Object.entries(scopeBody)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined) z.globalRegistry.add(schema, { ...schema.meta(), description });
}

export const scopeSchema = z.strictObject({
    path: relativePathSchema
        .refine(
            (path) =>
                stripTrailingSlashes(
                    stripTrailingSlashes(stripTrailingSlashes(stripTrailingSlashes(stripTrailingSlashes(path)))),
                )
                    .split('/')
                    .every(
                        (segment) =>
                            !RESERVED_SEGMENTS.has(segment) &&
                            !UNSAFE_CHARACTERS.test(segment) &&
                            !UNSAFE_PATH_END.test(segment) &&
                            !DEVICE_NAME.test(segment),
                    ),
            SCOPE_PATH_MESSAGES.portable,
        )
        .refine((path) => !GSPOT_FOLDER_PATH.test(path.normalize('NFC')), SCOPE_PATH_MESSAGES.gspot)
        .meta(SETTING_DEFINITIONS['scope.path']),
    configurations: z
        .string()
        .array()
        .default(SETTING_DEFINITIONS['scope.configurations'].default)
        .meta(SETTING_DEFINITIONS['scope.configurations']),
    removed_configurations: removedConfigurationsSchema
        .default(SETTING_DEFINITIONS['scope.removed_configurations'].default)
        .meta(SETTING_DEFINITIONS['scope.removed_configurations']),
    test_files: relativePathSchema.array().optional().meta(SETTING_DEFINITIONS['scope.test_files']),
    ...scopeBody,
} satisfies SchemaShape<NonNullable<ParsedSettings['scope']>[number], WrittenScope>);

export const rootSettingSchemas = {
    level: levelSchema.default(SETTING_DEFINITIONS['level'].default).meta(SETTING_DEFINITIONS['level']),
    tool_timeout_seconds: z
        .number()
        .int()
        .positive()
        .default(SETTING_DEFINITIONS['tool_timeout_seconds'].default)
        .meta(SETTING_DEFINITIONS['tool_timeout_seconds']),
    test_files: relativePathSchema
        .array()
        .default(SETTING_DEFINITIONS['test_files'].default)
        .meta(SETTING_DEFINITIONS['test_files']),
};

export const settingsSchema = z
    .strictObject({
        ...rootSettingSchemas,
        configurations: z
            .string()
            .array()
            .default(SETTING_DEFINITIONS['configurations'].default)
            .meta(SETTING_DEFINITIONS['configurations']),
        removed_configurations: removedConfigurationsSchema
            .default(SETTING_DEFINITIONS['removed_configurations'].default)
            .meta(SETTING_DEFINITIONS['removed_configurations']),
        scope: scopeSchema.array().optional(),
        ...rootBody,
        import_rule: importRulesSchema,
        ignore: ignoreSchema.array().optional(),
        command_check: commandCheckSchema.array().optional(),
        format: formatSchema.prefault({}),
        limits: limitsSchema.prefault({}),
        naming: namingSchema.prefault({}),
        structure: rootStructure.unwrap().prefault({}),
        hooks: hooksSchema.optional(),
        ci: ciSchema.optional(),
        rules: rulesSchema.prefault({}),
    })
    .superRefine((written, context) => {
        const records = [
            {
                key: 'import_rule',
                field: 'name',
                names: written.import_rule.map((rule) => rule.name),
            },
            {
                key: 'scope',
                field: 'path',
                names: (written.scope ?? []).map((scope) =>
                    stripTrailingSlashes(scope.path).normalize('NFC').toLowerCase(),
                ),
            },
            {
                key: 'command_check',
                field: 'id',
                names: (written.command_check ?? []).map((commandCheck) => commandCheck.id),
            },
        ];
        for (const { key, field, names } of records) {
            const seen = new Set<string>();
            for (const [index, name] of names.entries()) {
                if (seen.has(name))
                    context.addIssue({
                        code: 'custom',
                        path: [key, index, field],
                        message: `Two [[${key}]] records name ${name}. Keep one.`,
                    });
                seen.add(name);
            }
        }
    })
    .meta({ examples: SETTINGS_EXAMPLES }) satisfies z.ZodType<ParsedSettings, WrittenSettings>;

for (const [name, schema] of Object.entries(settingsSchema.shape)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined) z.globalRegistry.add(schema, { ...schema.meta(), description });
}
