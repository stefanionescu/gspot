import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { namingSchema } from '#cli/settings/schema/naming.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { importRulesSchema } from '#cli/settings/schema/imports.ts';
import { type TemplateTables } from '#cli/types/settings/templates.ts';
import { buildPathKey, trimTrailingSlashes } from '#cli/system/paths.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { SCHEMA_URL, NAMED_FINDING_CHECKS } from '#cli/config/settings/file.ts';
import { toolsSchema as publicToolsSchema } from '#cli/settings/schema/tools.ts';
import { levelSchema, commandCheckFields } from '#cli/configurations/schema/parts.ts';
import { ciSchema, rulesSchema, hooksSchema } from '#cli/settings/schema/integrations.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { type WrittenScope, type ParsedSettings, type WrittenSettings } from '#cli/types/settings/file.ts';

import {
    formatSchema,
    relativePath,
    relativePaths,
    nonemptyPaths,
    localDateSchema,
    calendarDateSchema,
    unwrapSettingSchema,
} from '#cli/settings/schema/parts.ts';
import {
    ALLOWED_WORD,
    LEVEL_SUMMARY,
    ALL_LEVEL_SUMMARY,
    SETTINGS_EXAMPLES,
    TABLE_DESCRIPTIONS,
    JSON_SCHEMA_DIALECT,
    DEFAULT_TEST_PATTERNS,
    INTERNAL_SCHEMA_METADATA,
} from '#cli/config/settings/schema.ts';

const ignoreSchema = z
    .strictObject({
        check: z.string().optional().describe(SETTING_DECLARATIONS['ignore.check'].description),
        rule: z.string().optional().describe(SETTING_DECLARATIONS['ignore.rule'].description),
        names: z.array(z.string().min(1)).min(1).optional().describe(SETTING_DECLARATIONS['ignore.names'].description),
        paths: relativePaths.optional().describe(SETTING_DECLARATIONS['ignore.paths'].description),
        reason: z
            .string({ error: 'needs a reason. Add `reason = "..."` to this entry.' })
            .describe(SETTING_DECLARATIONS['ignore.reason'].description),
        until: localDateSchema
            .optional()
            .meta({ description: 'Stop applying this ignore on this date, in YYYY-MM-DD format (UTC).' }),
    } satisfies SchemaShape<
        NonNullable<ParsedSettings['ignore']>[number],
        NonNullable<WrittenSettings['ignore']>[number]
    >)
    .superRefine((entry, context) => {
        if (entry.names !== undefined && !NAMED_FINDING_CHECKS.has(entry.check ?? ''))
            context.addIssue({
                code: 'custom',
                path: ['names'],
                message: `names applies only to ${new Intl.ListFormat('en', { type: 'conjunction' }).format(NAMED_FINDING_CHECKS)}, whose findings name a definition.`,
            });
        if (entry.check !== undefined) return;
        if (entry.paths === undefined || entry.paths.length === 0)
            context.addIssue({ code: 'custom', path: ['paths'], message: 'An ignore without check needs paths.' });
        if (entry.rule !== undefined)
            context.addIssue({
                code: 'custom',
                path: ['rule'],
                message: 'An ignore without check cannot name a rule. Add the check that owns the rule.',
            });
    });

const commandCheckSchema = z.strictObject({
    ...commandCheckFields,
    name: z.string().min(1).describe(SETTING_DECLARATIONS['command_check.name'].description),
    command: commandCheckFields.command.unwrap().describe('The executable and arguments to run on selected files.'),
    paths: nonemptyPaths.meta({ description: 'Repository-relative glob patterns selecting inputs.' }),
    outputs: relativePaths.optional().describe(SETTING_DECLARATIONS['command_check.outputs'].description),
    stage: commandCheckFields.stage
        .exclude(['message'])
        .meta({ description: 'The earliest stage that runs this check.' }),
    help: commandCheckFields.help.meta({ description: 'Instructions for resolving findings.' }),
    fix: commandCheckFields.fix.describe('The executable and arguments that correct findings.'),
    exit_codes: commandCheckFields.exit_codes.describe(
        'Nonzero statuses that mean findings from command and fix. Other nonzero statuses mean execution failure.',
    ),
    summary: commandCheckFields.summary.meta({ description: 'A short description shown in check listings.' }),
    output: commandCheckFields.output.describe('The parser and location patterns used to read findings.'),
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

/** One scope record: its path, configuration choices, and settings tables. */
const scopeSchema = z.strictObject({
    path: relativePath.describe(SETTING_DECLARATIONS['scope.path'].description),
    configurations: z.array(z.string()).default([]).describe(SETTING_DECLARATIONS['scope.configurations'].description),
    removed_configurations: z
        .array(z.string())
        .default([])
        .describe(SETTING_DECLARATIONS['scope.removed_configurations'].description),
    test_files: z.array(relativePath).optional().describe(SETTING_DECLARATIONS['scope.test_files'].description),
    ...scopeBody,
} satisfies SchemaShape<NonNullable<ParsedSettings['scope']>[number], WrittenScope>) satisfies z.ZodType<
    NonNullable<ParsedSettings['scope']>[number],
    WrittenScope
>;

/** Top-level gspot.toml keys shown by gspot list settings and the settings reference. */
const rootSettingSchemas = {
    level: levelSchema.default('recommended').meta({
        description: `${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY}`,
    }),
    allowed_words: z
        .record(z.string().regex(ALLOWED_WORD, 'Use a plain word, without a regular expression pattern.'), z.string())
        .default({})
        .meta({
            reason_values: true,
            description: 'Words accepted beyond the shipped spelling list, each with the reason it is a real word.',
        }),
    tool_timeout_seconds: z
        .number()
        .int()
        .positive()
        .default(SETTING_DEFAULTS.tool_timeout_seconds)
        .describe(
            'The time limit in seconds for every tool command, including installation and version reads. Root only.',
        ),
    test_files: z
        .array(relativePath)
        .default(() => [...DEFAULT_TEST_PATTERNS])
        .meta({
            description: 'Test files. Linters apply their test rules to these files.',
        }),
};

const settingsSchema = z
    .strictObject({
        ...rootSettingSchemas,
        configurations: z.array(z.string()).default([]).describe(SETTING_DECLARATIONS['configurations'].description),
        removed_configurations: z
            .array(z.string())
            .default([])
            .describe(SETTING_DECLARATIONS['removed_configurations'].description),
        scope: z.array(scopeSchema).optional(),
        ...rootBody,
        import_rule: importRulesSchema,
        ignore: z.array(ignoreSchema).optional(),
        command_check: z.array(commandCheckSchema).optional(),
        structure: rootStructure,
        hooks: hooksSchema.optional(),
        ci: ciSchema.optional(),
        rules: rulesSchema.prefault({}),
    } satisfies SchemaShape<ParsedSettings, WrittenSettings>)
    .superRefine((written, context) => {
        const records = [
            {
                key: 'scope',
                field: 'path',
                names: (written.scope ?? []).map((entry) => buildPathKey(trimTrailingSlashes(entry.path))),
            },
            {
                key: 'command_check',
                field: 'name',
                names: (written.command_check ?? []).map((entry) => entry.name),
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

/**
 * Build the editor schema for this gspot version.
 *
 * @returns the JSON Schema document.
 */
function buildJsonSchema(): Record<string, unknown> {
    const converted = convertToJsonSchema(settingsSchema);
    // The tables carry no description of their own; editors show this one on hover.
    const properties = Object.entries(converted.properties as Record<string, z.core.JSONSchema.JSONSchema>).map(
        ([name, node]) => {
            const description = node.description ?? TABLE_DESCRIPTIONS[name];
            return [name, description === undefined ? node : { ...node, description }];
        },
    );
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: SCHEMA_URL,
        title: SETTINGS_FILE,
        description: 'The settings of gspot for one repository.',
        ...converted,
        properties: Object.fromEntries(properties),
    };
}

/**
 * Locate one setting in the root, configuration, and tool schemas.
 *
 * @param key the dotted setting name.
 * @returns its schema, or undefined when the key names no setting.
 */
function findSettingSchema(key: string): z.ZodType | undefined {
    const direct = Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).find(([name]) => name === key);
    if (direct !== undefined) return direct[1];
    const parts = key.split('.');
    const table = parts.shift();
    let schema: z.ZodType | undefined;
    if (table === 'tools') {
        const tool = parts.shift();
        schema = Object.entries(publicToolsSchema.shape).find(([name]) => name === tool)?.[1];
    } else schema = Object.entries(configurationTableSchemas).find(([name]) => name === table)?.[1];
    for (const part of parts) {
        if (schema !== undefined) schema = unwrapSettingSchema(schema);
        if (!(schema instanceof z.ZodObject)) return undefined;
        schema = schema.shape[part] as z.ZodType | undefined;
    }
    return schema;
}

/** Reusable root settings without repository scope records. */
const templateSchema = settingsSchema.safeExtend({ scope: z.never().optional() } satisfies SchemaShape<
    Pick<ParsedSettings, 'scope'>,
    Pick<WrittenSettings, 'scope'>
>) satisfies z.ZodType<Omit<ParsedSettings, 'scope'>, TemplateTables>;
function buildDateJsonSchema(): z.core.JSONSchema.JSONSchema {
    const date = z.toJSONSchema(calendarDateSchema);
    Reflect.deleteProperty(date, '$schema');
    return date;
}

/**
 * Convert a settings schema to JSON Schema, and keep written defaults and declaration metadata.
 *
 * @param schema the runtime validator.
 * @returns the JSON Schema, with TOML dates as calendar strings.
 */
function convertToJsonSchema(schema: z.ZodType): z.core.JSONSchema.JSONSchema {
    return z.toJSONSchema(schema, {
        io: 'input',
        reused: 'ref',
        unrepresentable: ({ zodSchema }) => (zodSchema === localDateSchema ? buildDateJsonSchema() : 'throw'),
        override: ({ zodSchema, jsonSchema }) => {
            if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
            for (const key of INTERNAL_SCHEMA_METADATA) Reflect.deleteProperty(jsonSchema, key);
            if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion)
                jsonSchema.default = zodSchema.def.defaultValue;
            const metadata = z.globalRegistry.get(zodSchema);
            if (metadata && Object.hasOwn(metadata, 'examples'))
                Object.assign(jsonSchema, { examples: metadata['examples'] });
        },
    });
}

export { scopeSchema, settingsSchema, templateSchema, buildJsonSchema, findSettingSchema, rootSettingSchemas };
