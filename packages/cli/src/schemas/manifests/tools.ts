import semver from 'semver';
import { z } from 'zod';

import {
    CASE_NAMES,
    EXTENSION_PATTERN,
    INSTALLER_VERSION_MESSAGE,
    LEVELS,
    MINIMUM_VERSION_PATTERN,
    NAMED_CATEGORIES,
    NUMERIC_MINIMUM_MESSAGE,
    RULE_PLACEHOLDER,
    SHIPPED_CHECKSUM_PATTERN,
    TOOL_BUILDS,
    TOOL_KINDS,
    VALID_UNICODE_MESSAGE,
} from '#cli/config/manifests.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { commandSchema, outputSchema } from '#cli/schemas/manifests/checks.ts';
import type { ToolInstallers } from '#cli/types/manifests.ts';

export const nonemptyStringSchema = z.string().min(1);

export const regexSchema = z.string().refine((pattern) => {
    try {
        return new RegExp(pattern, 'u').unicode;
    } catch {
        return false;
    }
}, VALID_UNICODE_MESSAGE);

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

const identifierCategorySchema = z.enum(NAMED_CATEGORIES);

const sourcePathSchema = z.string().min(1);

export const namingExceptionSchema = z.strictObject({
    paths: sourcePathSchema.array().min(1).optional().meta({ description: 'Where the exception applies.' }),
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

export const writtenNamingExceptionSchema = namingExceptionSchema.extend({
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
        version_pattern: z.string().optional(),
        crash_pattern: regexSchema.optional(),
        finding_header_pattern: regexSchema.optional(),
        rule_url: z.string().includes(RULE_PLACEHOLDER, { message: 'A rule page names where {rule} goes.' }).optional(),
        rule_prefix: z.string().min(1).optional(),
        output: outputSchema.optional(),
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
                error: 'A suppression that gspot accepts shows an example with a reason.',
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
        peers: z
            .record(
                z.string().min(1),
                z.string().refine((range) => semver.validRange(range) !== null, 'A peer range is a semver range.'),
            )
            .optional(),
        when: toolConditionSchema.array().min(1).optional(),
        off: z
            .strictObject({
                always: z.string().min(1).array().default([]),
                basic: z.string().min(1).array().default([]),
            })
            .optional(),
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
            error: 'A tool reference contains only its name.',
        })
        .transform(({ name }) => name),
    toolSchema,
]);
