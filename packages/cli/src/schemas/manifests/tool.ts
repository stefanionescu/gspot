import { z } from 'zod';
import semver from 'semver';
import type { ToolInstallers } from '#cli/types/manifests.ts';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { MAX_EXIT_CODE } from '#cli/config/manifests/fields.ts';
import { TOOL_KINDS, TOOL_BUILDS } from '#cli/config/manifests/names.ts';
import { regexSchema, commandSchema, conditionSchema } from '#cli/schemas/manifests/fields.ts';

import {
    EXTENSION_PATTERN,
    MINIMUM_VERSION_PATTERN,
    NUMERIC_MINIMUM_MESSAGE,
    SHIPPED_CHECKSUM_PATTERN,
    INSTALLER_VERSION_MESSAGE,
} from '#cli/config/manifests/tool.ts';

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

const miseInstallerSchema = z.union([
    z.string(),
    installerDefinitionSchema.partial({ version: true }).extend({
        options: installerOptionsSchema.optional(),
        checksums: z.record(z.string().min(1), z.string().regex(SHIPPED_CHECKSUM_PATTERN)).optional(),
    }),
]);

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
