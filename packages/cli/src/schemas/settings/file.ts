import { z } from 'zod';
import { ciSchema } from '#cli/schemas/settings/ci.ts';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { hooksSchema } from '#cli/schemas/settings/hooks.ts';
import { rulesSchema } from '#cli/schemas/settings/rules.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { SETTINGS_EXAMPLES, NAMED_FINDING_CHECKS } from '#cli/config/settings/file.ts';
import { levelSchema, commandCheckFields } from '#cli/schemas/configurations/fields.ts';
import { toolsSchema as publicToolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { type WrittenScope, type ParsedSettings, type WrittenSettings } from '#cli/types/settings/file.ts';

import {
    formatSchema,
    relativePath,
    nonemptyPaths,
    relativePaths,
    localDateSchema,
    allowReasonedValue,
    unwrapSettingSchema,
} from '#cli/schemas/settings/fields.ts';

const ignoreSchema = z
    .strictObject({
        check: z.string().optional().describe(SETTING_DEFINITIONS['ignore.check'].description),
        rule: z.string().optional().describe(SETTING_DEFINITIONS['ignore.rule'].description),
        names: z.string().min(1).array().min(1).optional().describe(SETTING_DEFINITIONS['ignore.names'].description),
        paths: relativePaths.optional().describe(SETTING_DEFINITIONS['ignore.paths'].description),
        reason: z
            .string({ error: 'needs a reason. Add `reason = "..."` to this record.' })
            .describe(SETTING_DEFINITIONS['ignore.reason'].description),
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
        if (ignore.check !== undefined) return;
        if (ignore.paths === undefined || ignore.paths.length === 0)
            context.addIssue({ code: 'custom', path: ['paths'], message: 'An ignore without check needs paths.' });
        if (ignore.rule !== undefined)
            context.addIssue({
                code: 'custom',
                path: ['rule'],
                message: 'An ignore without check cannot name a rule. Add the check that owns the rule.',
            });
    });

const commandCheckSchema = z.strictObject({
    id: z.string().min(1).describe(SETTING_DEFINITIONS['command_check.id'].description),
    command: commandCheckFields.command.unwrap().meta(SETTING_DEFINITIONS['command_check.command']),
    paths: nonemptyPaths.meta(SETTING_DEFINITIONS['command_check.paths']),
    outputs: relativePaths.optional().describe(SETTING_DEFINITIONS['command_check.outputs'].description),
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
    docs: configurationTableSchemas.docs.unwrap().omit({ banned_headings: true }).optional() satisfies z.ZodType<
        NonNullable<ParsedSettings['scope']>[number]['docs'],
        WrittenScope['docs']
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
            eslint: publicToolsSchema.shape.eslint.unwrap().omit({ override: true }).optional() satisfies z.ZodType<
                NonNullable<NonNullable<ParsedSettings['scope']>[number]['tools']>['eslint'],
                NonNullable<WrittenScope['tools']>['eslint']
            >,
        } satisfies SchemaShape<
            Pick<NonNullable<NonNullable<ParsedSettings['scope']>[number]['tools']>, 'eslint'>,
            Pick<NonNullable<WrittenScope['tools']>, 'eslint'>
        >)
        .optional(),
};

export const scopeSchema = z.strictObject({
    path: relativePath.describe(SETTING_DEFINITIONS['scope.path'].description),
    configurations: z
        .string()
        .array()
        .default(SETTING_DEFINITIONS['scope.configurations'].default)
        .describe(SETTING_DEFINITIONS['scope.configurations'].description),
    removed_configurations: allowReasonedValue(z.string().array(), SETTING_DEFINITIONS['scope.removed_configurations']),
    test_files: relativePath.array().optional().describe(SETTING_DEFINITIONS['scope.test_files'].description),
    ...scopeBody,
}) satisfies z.ZodType<NonNullable<ParsedSettings['scope']>[number], WrittenScope>;

export const rootSettingSchemas = {
    level: levelSchema.default(SETTING_DEFINITIONS['level'].default).meta(SETTING_DEFINITIONS['level']),
    tool_timeout_seconds: z
        .number()
        .int()
        .positive()
        .default(SETTING_DEFINITIONS['tool_timeout_seconds'].default)
        .meta(SETTING_DEFINITIONS['tool_timeout_seconds']),
    test_files: relativePath
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
            .describe(SETTING_DEFINITIONS['configurations'].description),
        removed_configurations: allowReasonedValue(z.string().array(), SETTING_DEFINITIONS['removed_configurations']),
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
                    trimTrailingSlashes(scope.path).normalize('NFC').toLowerCase(),
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

export const RECORD_FIELDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
    Object.entries({
        scope: scopeSchema.pick({
            path: true,
            configurations: true,
            removed_configurations: true,
            test_files: true,
        }).shape,
        command_check: commandCheckSchema.shape,
        ignore: ignoreSchema.shape,
        import_rule: importRulesSchema.unwrap().element.shape,
        'format.override': formatSchema.shape.override.unwrap().element.shape,
        'naming.override': namingSchema.shape.override.unwrap().element.shape,
        'coverage.swift_target': configurationTableSchemas.coverage.unwrap().shape.swift_target.unwrap().element.shape,
        'licenses.allowed_package': configurationTableSchemas.licenses.unwrap().shape.allowed_package.unwrap().element
            .shape,
        'site.size_limit': configurationTableSchemas.site.unwrap().shape.size_limit.unwrap().element.shape,
        'tools.eslint.override': publicToolsSchema.shape.eslint.unwrap().shape.override.unwrap().element.shape,
        'tools.v8r.schema': publicToolsSchema.shape.v8r.unwrap().shape.schema.unwrap().element.shape,
    }).map(([name, fields]) => [name, Object.keys(fields)]),
);

const schemas = new Map<string, z.ZodType>(Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }));
const toolSchemas = new Map<string, z.ZodType>(Object.entries(publicToolsSchema.shape));
const configurationSchemas = new Map<string, z.ZodType>(Object.entries(configurationTableSchemas));

/**
Locate one setting in the root, configuration, and tool schemas.

@param key the dotted setting name.
@returns its schema, or undefined when the key names no setting.
*/
export function findSettingSchema(key: string): z.ZodType | undefined {
    const direct = schemas.get(key);
    if (direct !== undefined) return direct;
    const segments = key.split('.');
    const table = segments.shift();
    let schema: z.ZodType | undefined;
    if (table === 'tools') {
        const tool = segments.shift();
        schema = toolSchemas.get(tool ?? '');
    } else schema = configurationSchemas.get(table ?? '');
    for (const segment of segments) {
        if (schema !== undefined) schema = unwrapSettingSchema(schema);
        if (!(schema instanceof z.ZodObject)) return undefined;
        schema = schema.shape[segment] as z.ZodType | undefined;
    }
    return schema;
}
