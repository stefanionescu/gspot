import { z } from 'zod';
import semver from 'semver';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers.ts';
import type { ToolInstallers } from '#cli/types/manifests.ts';

import {
    STAGES,
    LEVELS,
    CASE_NAMES,
    TOOL_KINDS,
    TOOL_BUILDS,
    MAX_EXIT_CODE,
    DEFAULT_PATTERN,
    NAMED_CATEGORIES,
    RULE_PLACEHOLDER,
    EXTENSION_PATTERN,
    DEFAULT_FILE_PATTERN,
    VALID_UNICODE_MESSAGE,
    DEFAULT_OUTPUT_FORMAT,
    MINIMUM_VERSION_PATTERN,
    NUMERIC_MINIMUM_MESSAGE,
    DEFAULT_GROUPED_PATTERN,
    SHIPPED_CHECKSUM_PATTERN,
    INSTALLER_VERSION_MESSAGE,
} from '#cli/config/manifests.ts';

const findingExitCodesSchema = z.number().int().min(1).max(MAX_EXIT_CODE).array();

export const nonemptyStringSchema = z.string().min(1);

export const checkStageSchema = z.enum(STAGES);

export const commandSchema = z
    .string()
    .array()
    .min(1)
    .refine((command) => command[0] !== '', { message: 'The executable cannot be empty.', path: [0] })
    .meta({ prefixItems: [{ type: 'string', minLength: 1 }] });

export const regexSchema = z.string().superRefine((pattern, context) => {
    try {
        new RegExp(pattern, 'u');
    } catch {
        context.addIssue({ code: 'custom', message: VALID_UNICODE_MESSAGE });
    }
});

export const levelSchema = z.enum(LEVELS);

export const operatingSystemSchema = z.enum(OPERATING_SYSTEMS.map((system) => system.name));

export const conditionSchema = z.strictObject({
    configuration: z.string().min(1),
    config_file: z.string().min(1),
    level: levelSchema,
    setting: z.string().min(1),
    dependencies: z.string().min(1).array().min(1),
    absent_dependencies: z.string().min(1).array().min(1),
    filenames: z.string().min(1).array().min(1),
    tags: z.string().min(1).array().min(1),
    runtimes: z.enum(JAVASCRIPT_RUNTIMES).array().min(1),
});

export const outputSchema = z
    .strictObject({
        format: z
            .union([
                z.literal('regex').meta({
                    description:
                        'Read findings from lines matched by pattern and its named file, line, column, rule, and message groups.',
                }),
                z.literal('grouped').meta({
                    description:
                        'Read a file heading matched by file_pattern, followed by findings matched by pattern.',
                }),
                z.literal('knip').meta({ description: 'Read Knip JSON issue categories and source positions.' }),
                z.literal('semgrep').meta({
                    description: 'Read Semgrep JSON results and source parse errors, with locations and rule IDs.',
                }),
                z
                    .literal('typos')
                    .meta({ description: 'Read typos JSON and convert byte offsets to character columns.' }),
                z
                    .literal('markdownlint')
                    .meta({ description: 'Read markdownlint result objects and their rule and source locations.' }),
                z.literal('taplo').meta({ description: 'Read Taplo syntax errors and formatting differences.' }),
                z.literal('json').meta({
                    description: 'Read JSON findings using list, children, and fields to select report entries.',
                }),
                z
                    .literal('lines')
                    .meta({ description: 'Report each nonempty output line as a finding without a source location.' }),
                z.literal('none').meta({ description: 'Use the exit status without parsing output into findings.' }),
            ])
            .describe('How gspot reads the output: json, regex, grouped, lines, none, or the format of a named tool.'),
        list: z.string().describe('For json: the path to the list of findings.').optional(),
        children: z.string().describe('For json: the field of each item that holds its findings.').optional(),
        line_base: z
            .union([z.literal(0), z.literal(1)])
            .describe('Whether the tool counts lines from 0 or 1.')
            .optional(),
        fields: z
            .strictObject({
                file: z.string().describe('For json: the field that holds the file.').optional(),
                line: z.string().describe('For json: the field that holds the line.').optional(),
                column: z.string().describe('For json: the field that holds the column.').optional(),
                rule: z.string().describe('For json: the field that holds the lint rule.').optional(),
                message: z.string().describe('For json: the field that holds the message.').optional(),
                fixable: z
                    .string()
                    .describe('For json: the field that is set when the tool can fix the finding.')
                    .optional(),
            })
            .optional()
            .describe('For json: the report fields that supply each finding property.'),
        pattern: z
            .string()
            .describe(
                'For regex: the pattern for one finding, with named groups file, line, column, rule, and message.',
            )
            .optional(),
        file_pattern: z
            .string()
            .describe('For grouped: the pattern for a line that names the file of the findings below it.')
            .optional(),
        fixable: z.string().describe('For regex: the pattern that marks a fixable finding.').optional(),
        message: z
            .string()
            .describe('For regex: the message of every finding whose pattern has no message group.')
            .optional(),
    })
    .transform((output) => {
        switch (output.format) {
            case 'regex': {
                return { ...output, format: 'regex' as const, pattern: output.pattern ?? DEFAULT_PATTERN };
            }
            case 'grouped': {
                return {
                    ...output,
                    format: 'grouped' as const,
                    pattern: output.pattern ?? DEFAULT_GROUPED_PATTERN,
                    file_pattern: output.file_pattern ?? DEFAULT_FILE_PATTERN,
                };
            }
            default: {
                return { ...output, format: output.format };
            }
        }
    });

export const commandCheckFields = {
    command: commandSchema.optional(),
    stage: checkStageSchema,
    summary: z.string().optional(),
    help: z.string().optional(),
    fix: commandSchema.optional(),
    exit_codes: findingExitCodesSchema.optional(),
    output: outputSchema.default(DEFAULT_OUTPUT_FORMAT),
};

const identifierCategorySchema = z.enum(NAMED_CATEGORIES);

const sourcePathSchema = z.string().min(1);

export const namingOverrideSchema = z.strictObject({
    paths: sourcePathSchema.array().min(1).optional().meta({ description: 'Where the override applies.' }),
    languages: z.string().array().optional().meta({ description: 'The languages it applies to.' }),
    categories: identifierCategorySchema
        .array()
        .optional()
        .meta({ description: 'The kinds of name it applies to. Unknown kinds are refused.' }),
    ignored_prefix: z.string().optional().meta({ description: 'A prefix not counted as a word, such as ^test_.' }),
    ignored_names_pattern: regexSchema.optional().meta({
        description: 'A regular expression for names that skip the naming rules, such as ^__[a-z][a-z0-9_]*__$.',
    }),
    allow_digits: z.boolean().optional().meta({ description: 'Accept digits in names.' }),
    allow_repeated_words: z.boolean().optional().meta({ description: 'Accept a word twice in one name.' }),
    allowed_names: z.string().array().optional().meta({ description: 'Names accepted despite the naming rules.' }),
    cases: z.enum(CASE_NAMES).array().optional().meta({ description: 'The cases accepted here.' }),
    reason: z.string().optional().meta({ description: 'Why these names may break the rules.' }),
});

export const writtenNamingOverrideSchema = namingOverrideSchema.extend({
    reason: z.string().min(1),
});

const minimumVersionSchema = z
    .string()
    .regex(MINIMUM_VERSION_PATTERN)
    .transform((minimum, context) => {
        const version = semver.coerce(minimum);
        if (version === null) {
            context.addIssue({ code: 'custom', message: NUMERIC_MINIMUM_MESSAGE });
            return z.NEVER;
        }
        return version.version;
    });

const installerDefinitionSchema = z.strictObject({ name: z.string(), version: z.string() });

const installerSchema = z.union([z.string(), installerDefinitionSchema]);

const installerOptionsSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

const miseInstallerSchema = installerDefinitionSchema.partial({ version: true }).extend({
    options: installerOptionsSchema.optional(),
    checksums: z.record(z.string().min(1), z.string().regex(SHIPPED_CHECKSUM_PATTERN)),
});

const installerFields = {
    npm: installerSchema.optional(),
    pypi: installerSchema.optional(),
    mise: miseInstallerSchema.optional(),
};

const toolConditionSchema = conditionSchema.pick({ setting: true, level: true }).partial();

const replacementSchema = z.strictObject({
    file: z.string().min(1),
    table: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
});

const overrideSchema = z.strictObject({
    files: z.string().min(1),
    options: z.record(z.string(), z.unknown()),
});

const replacementKeySchema = z.discriminatedUnion('pointer', [
    replacementSchema.extend({ pointer: z.literal(false).optional() }),
    replacementSchema.extend({
        file: z.literal('package.json'),
        key: z.string().min(1),
        pointer: z.literal(true),
    }),
]);

const toolSchema = z
    .strictObject({
        name: z.string(),
        kind: z.enum(TOOL_KINDS).default('program'),
        version: z.string().optional(),
        min_version: minimumVersionSchema.optional(),
        interpreter_flag: z.string().min(1).optional(),
        install_help: z.string().min(1).optional(),
        system: z.boolean().optional(),
        builds: z.enum(TOOL_BUILDS).array().min(1).optional(),
        version_command: commandSchema.optional(),
        version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
        version_pattern: z.string().optional(),
        crash_pattern: regexSchema.optional(),
        finding_header_pattern: regexSchema.optional(),
        rule_url: z.string().includes(RULE_PLACEHOLDER, { message: 'A rule page names where {rule} goes.' }).optional(),
        rule_prefix: z.string().min(1).optional(),
        suppression: z
            .strictObject({
                marker: regexSchema,
                separator: regexSchema.optional(),
                all_rules: regexSchema.optional(),
                limit_rules: regexSchema.optional(),
                inline_marker: regexSchema.optional(),
                reason: regexSchema,
                forbidden: z.boolean().optional(),
                example: z.string().optional(),
            })
            .refine((form) => form.forbidden === true || form.example !== undefined, {
                message: 'A suppression that gspot accepts shows an example with a reason.',
                path: ['example'],
            })
            .optional(),
        prettier: z
            .strictObject({
                module: z.string().min(1),
                extensions: z.string().regex(EXTENSION_PATTERN).array().default([]),
                overrides: overrideSchema.array().default([]),
            })
            .optional(),
        eslint: z.strictObject({ extensions: z.string().regex(EXTENSION_PATTERN).array().min(1) }).optional(),
        requires: z.string().min(1).array().optional(),
        when: toolConditionSchema.array().min(1).optional(),
        replace: z.string().min(1).array().optional(),
        replace_key: replacementKeySchema
            .refine(
                (row) => (row.key === undefined) !== (row.table === undefined),
                'A replace_key record selects one key or table.',
            )
            .array()
            .optional(),
        ...installerFields,
    })
    .superRefine((tool, context) => {
        for (const name of ['pypi', 'mise'] as const) {
            const installer = tool[name];
            if (installer === undefined) continue;
            const version = typeof installer === 'string' ? tool.version : (installer.version ?? tool.version);
            if (version === undefined)
                context.addIssue({ code: 'custom', path: [name], message: INSTALLER_VERSION_MESSAGE });
        }
    })
    .transform(({ npm, pypi, mise, ...tool }) => {
        const definitions = { npm, pypi, mise };
        const installers: ToolInstallers = {};
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition === undefined) continue;
            installers[name] =
                typeof definition === 'string'
                    ? { name: definition, version: tool.version }
                    : { ...definition, version: definition.version ?? tool.version };
        }
        return { ...tool, installers };
    });

export const manifestToolSchema = z.union([
    z
        .looseObject({ name: z.string() })
        .refine((reference) => Object.keys(reference).length === 1, {
            abort: true,
            message: 'A tool reference contains only its name.',
        })
        .transform(({ name }) => name),
    toolSchema,
]);
