import { z } from 'zod';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { levelSchema, commandCheckFields } from '#cli/schemas/manifests/fields.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { toolsSchema as publicToolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, UNSAFE_CHARACTERS, RESERVED_SEGMENTS } from '#cli/config/system/files.ts';
import { ciSchema, hooksSchema, rulesSchema, namingSchema, importRulesSchema } from '#cli/schemas/settings/settings.ts';

import {
    formatSchema,
    relativePathSchema,
    nonemptyPathsSchema,
    removedConfigurationsSchema,
} from '#cli/schemas/settings/fields.ts';
import {
    COMMAND_CHECK_ID,
    GSPOT_FOLDER_PATH,
    SETTINGS_EXAMPLES,
    TABLE_DESCRIPTIONS,
    SCOPE_PATH_MESSAGES,
    NO_CHECK_RULE_MESSAGE,
    NO_CHECK_PATHS_MESSAGE,
} from '#cli/config/settings/settings.ts';

export const ignoreSchema = z
    .strictObject({
        check: z.string().optional().meta(SETTING_DEFINITIONS['ignore.check']),
        rule: z.string().optional().meta(SETTING_DEFINITIONS['ignore.rule']),
        paths: nonemptyPathsSchema.optional().meta(SETTING_DEFINITIONS['ignore.paths']),
        reason: z
            .string({ error: 'needs a reason. Add reason = "..." to this record.' })
            .meta(SETTING_DEFINITIONS['ignore.reason']),
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
});

const { structure: rootStructure, ...scopeTables } = configurationTableSchemas;

const rootBody = {
    ...scopeTables,
    tools: publicToolsSchema.optional(),
};

const scopeBody = {
    ...rootBody,
    dependencies: configurationTableSchemas.dependencies.unwrap().omit({ min_release_age_days: true }).optional(),
    prose: configurationTableSchemas.prose.unwrap().omit({ banned_headings: true }).optional(),
    coverage: z
        .strictObject({
            lines: configurationTableSchemas.coverage.unwrap().shape.lines,
            branches: configurationTableSchemas.coverage.unwrap().shape.branches,
            functions: configurationTableSchemas.coverage.unwrap().shape.functions,
            statements: configurationTableSchemas.coverage.unwrap().shape.statements,
        })
        .optional(),
    licenses: configurationTableSchemas.licenses.unwrap().omit({ allowed_package: true }).optional(),
    site: configurationTableSchemas.site.unwrap().omit({ size_limit: true }).optional(),
    naming: namingSchema.omit({ override: true }).optional(),
    structure: rootStructure.unwrap().pick({ environment_readers: true }).optional(),
    format: formatSchema.omit({ override: true }).optional(),
    tools: publicToolsSchema
        .omit({ v8r: true })
        .extend({
            eslint: publicToolsSchema.shape.eslint
                .unwrap()
                .omit({ override: true })
                .optional()
                .describe(publicToolsSchema.shape.eslint.description as string),
        })
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
        .prefault(SETTING_DEFINITIONS['scope.removed_configurations'].default)
        .meta(SETTING_DEFINITIONS['scope.removed_configurations']),
    test_files: relativePathSchema.array().optional().meta(SETTING_DEFINITIONS['scope.test_files']),
    ...scopeBody,
});

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
            .prefault(SETTING_DEFINITIONS['removed_configurations'].default)
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
    .meta({ examples: SETTINGS_EXAMPLES });

for (const [name, schema] of Object.entries(settingsSchema.shape)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined) z.globalRegistry.add(schema, { ...schema.meta(), description });
}
