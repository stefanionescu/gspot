import { z } from 'zod';
import { type SchemaShape } from '#cli/types/shapes.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { toolsSchema as publicToolsSchema } from '#cli/schemas/settings/tools.ts';
import { levelSchema, commandCheckFields } from '#cli/schemas/configurations/parts.ts';
import { ciSchema, hooksSchema, rulesSchema } from '#cli/schemas/settings/integrations.ts';
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
} from '#cli/schemas/settings/parts.ts';
import {
    SCHEMA_URL,
    ALLOWED_WORD,
    SETTINGS_EXAMPLES,
    INTERNAL_FACT_KEYS,
    TABLE_DESCRIPTIONS,
    JSON_SCHEMA_DIALECT,
    NAMED_FINDING_CHECKS,
} from '#cli/config/settings/schema.ts';

const ignoreSchema = z
    .strictObject({
        check: z.string().optional().describe(SETTING_FACTS['ignore.check'].description),
        rule: z.string().optional().describe(SETTING_FACTS['ignore.rule'].description),
        names: z.array(z.string().min(1)).min(1).optional().describe(SETTING_FACTS['ignore.names'].description),
        paths: relativePaths.optional().describe(SETTING_FACTS['ignore.paths'].description),
        reason: z
            .string({ error: 'needs a reason. Add `reason = "..."` to this entry.' })
            .describe(SETTING_FACTS['ignore.reason'].description),
        until: localDateSchema.optional().meta(SETTING_FACTS['ignore.until']),
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
    name: z.string().min(1).describe(SETTING_FACTS['command_check.name'].description),
    command: commandCheckFields.command.unwrap().meta(SETTING_FACTS['command_check.command']),
    paths: nonemptyPaths.meta(SETTING_FACTS['command_check.paths']),
    outputs: relativePaths.optional().describe(SETTING_FACTS['command_check.outputs'].description),
    stage: commandCheckFields.stage.exclude(['message']).meta(SETTING_FACTS['command_check.stage']),
    summary: commandCheckFields.summary.meta(SETTING_FACTS['command_check.summary']),
    help: commandCheckFields.help.meta(SETTING_FACTS['command_check.help']),
    fix: commandCheckFields.fix.meta(SETTING_FACTS['command_check.fix']),
    exit_codes: commandCheckFields.exit_codes.meta(SETTING_FACTS['command_check.exit_codes']),
    output: commandCheckFields.output.meta(SETTING_FACTS['command_check.output']),
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
export const scopeSchema = z.strictObject({
    path: relativePath.describe(SETTING_FACTS['scope.path'].description),
    configurations: z
        .array(z.string())
        .default(SETTING_FACTS['scope.configurations'].default)
        .describe(SETTING_FACTS['scope.configurations'].description),
    removed_configurations: allowReasonedValue(z.array(z.string()), SETTING_FACTS['scope.removed_configurations']),
    test_files: z.array(relativePath).optional().describe(SETTING_FACTS['scope.test_files'].description),
    ...scopeBody,
}) satisfies z.ZodType<NonNullable<ParsedSettings['scope']>[number], WrittenScope>;

/** Top-level gspot.toml keys shown by gspot list settings and the settings reference. */
export const rootSettingSchemas = {
    level: levelSchema.default(SETTING_FACTS['level'].default).meta(SETTING_FACTS['level']),
    allowed_words: z
        .record(z.string().regex(ALLOWED_WORD, 'Use a plain word, without a regular expression pattern.'), z.string())
        .default(SETTING_FACTS['allowed_words'].default)
        .meta(SETTING_FACTS['allowed_words']),
    tool_timeout_seconds: z
        .number()
        .int()
        .positive()
        .default(SETTING_FACTS['tool_timeout_seconds'].default)
        .meta(SETTING_FACTS['tool_timeout_seconds']),
    test_files: z.array(relativePath).default(SETTING_FACTS['test_files'].default).meta(SETTING_FACTS['test_files']),
};

export const settingsSchema = z
    .strictObject({
        ...rootSettingSchemas,
        configurations: z
            .array(z.string())
            .default(SETTING_FACTS['configurations'].default)
            .describe(SETTING_FACTS['configurations'].description),
        removed_configurations: allowReasonedValue(z.array(z.string()), SETTING_FACTS['removed_configurations']),
        scope: z.array(scopeSchema).optional(),
        ...rootBody,
        import_rule: importRulesSchema,
        ignore: z.array(ignoreSchema).optional(),
        command_check: z.array(commandCheckSchema).optional(),
        structure: rootStructure,
        hooks: hooksSchema.optional(),
        ci: ciSchema.optional(),
        rules: rulesSchema.prefault({}),
    })
    .superRefine((written, context) => {
        const records = [
            {
                key: 'scope',
                field: 'path',
                names: (written.scope ?? []).map((entry) =>
                    trimTrailingSlashes(entry.path).normalize('NFC').toLowerCase(),
                ),
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
 * Derive the written field order of the record lists from their schemas.
 *
 * @returns record paths and their ordered field names; scopes retain their leading fields only.
 */
export function listRecordFields(): Record<string, string[]> {
    return Object.fromEntries(
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
            'coverage.swift_target': configurationTableSchemas.coverage.unwrap().shape.swift_target.unwrap().element
                .shape,
            'licenses.allowed_package': configurationTableSchemas.licenses.unwrap().shape.allowed_package.unwrap()
                .element.shape,
            'site.size_limit': configurationTableSchemas.site.unwrap().shape.size_limit.unwrap().element.shape,
            'tools.eslint.override': publicToolsSchema.shape.eslint.unwrap().shape.override.unwrap().element.shape,
            'tools.v8r.schema': publicToolsSchema.shape.v8r.unwrap().shape.schema.unwrap().element.shape,
        }).map(([name, fields]) => [name, Object.keys(fields)]),
    );
}

/**
 * Build the editor schema for this gspot version.
 *
 * @returns the JSON Schema document.
 */
export function buildJsonSchema(): Record<string, unknown> {
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
export function findSettingSchema(key: string): z.ZodType | undefined {
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

/**
 * Convert a settings schema to JSON Schema, and keep written defaults and declaration metadata.
 *
 * @param schema the runtime validator.
 * @returns the JSON Schema, with a description for TOML dates.
 */
function convertToJsonSchema(schema: z.ZodType): z.core.JSONSchema.JSONSchema {
    return z.toJSONSchema(schema, {
        io: 'input',
        reused: 'ref',
        unrepresentable: ({ zodSchema }) =>
            zodSchema === localDateSchema
                ? { description: 'An unquoted TOML date in YYYY-MM-DD form, such as 2026-11-08.' }
                : 'throw',
        override: ({ zodSchema, jsonSchema }) => {
            if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
            for (const key of INTERNAL_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
            if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion)
                jsonSchema.default = zodSchema.def.defaultValue;
            const facts = z.globalRegistry.get(zodSchema);
            if (facts && Object.hasOwn(facts, 'examples')) Object.assign(jsonSchema, { examples: facts['examples'] });
        },
    });
}
