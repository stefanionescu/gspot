import { z } from 'zod';
import semver from 'semver';
import { stripUndefined } from '#cli/system/tables.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { Tool, InstallerPin } from '#cli/types/configurations.ts';
import { regexSchema, commandSchema, conditionSchema } from '#cli/schemas/configurations/parts.ts';

import {
    TOOL_KINDS,
    TOOL_BUILDS,
    VERSION_FLOOR,
    MAX_EXIT_CODE,
    EXTENSION_PATTERN,
} from '#cli/config/configurations.ts';

/** Normalize version floors when gspot reads the manifest, before any version comparison. */
const versionFloorSchema = z
    .string()
    .regex(VERSION_FLOOR)
    .transform((floor, context) => {
        const version = semver.coerce(floor);
        if (version === null) {
            context.addIssue({ code: 'custom', message: 'Use a numeric minimum version.' });
            return z.NEVER;
        }
        return version.version;
    }) satisfies z.ZodType<string>;

const installerDefinition = z.strictObject({ name: z.string(), version: z.string() } satisfies SchemaShape<{
    name: string;
    version: string;
}>);

const installerSchema = z.union([z.string(), installerDefinition]) satisfies z.ZodType<
    string | { name: string; version: string }
>;

const installerOptionsSchema = z.record(z.string(), z.union([z.string(), z.boolean()])) satisfies z.ZodType<
    Record<string, string | boolean>
>;

// Options mise writes beside the version, such as no_app or rename_exe for a release that ships an app bundle.
const miseInstallerSchema = z.union([
    z.string(),
    installerDefinition.extend({ options: installerOptionsSchema.optional() } satisfies SchemaShape<{
        options?: Record<string, string | boolean> | undefined;
    }>),
]) satisfies z.ZodType<
    string | { name: string; version: string; options?: Record<string, string | boolean> | undefined }
>;

const installerFields = {
    npm: installerSchema.optional(),
    pypi: installerSchema.optional(),
    mise: miseInstallerSchema.optional(),
};

const toolConditionSchema = conditionSchema.pick({ setting: true, level: true }).partial() satisfies z.ZodType<
    NonNullable<Tool['when']>[number]
>;

const replacementSchema = z.strictObject({
    file: z.string().min(1),
    table: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
} satisfies SchemaShape<{ file: string; table?: string | undefined; key?: string | undefined }>);

const toolSchema = z
    .strictObject({
        name: z.string(),
        kind: z.enum(TOOL_KINDS).default('program'),
        version: z.string().optional(),
        min_version: versionFloorSchema.optional(),
        install_hint: z.string().min(1).optional(),
        system: z.boolean().optional(),
        // The systems that the tool has a build for; unset means every system.
        builds: z.array(z.enum(TOOL_BUILDS)).min(1).optional(),
        version_command: commandSchema.optional(),
        version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
        version_pattern: z.string().optional(),
        // Output that means the tool crashed instead of reporting findings, for every check that runs it.
        crash_pattern: regexSchema.optional(),
        // Header lines to drop when a per-file command reports a failure with no structure.
        finding_header_pattern: regexSchema.optional(),
        // Where the tool documents one rule; explain prints it with the rule name in place of `{rule}`.
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
            } satisfies SchemaShape<NonNullable<Tool['suppression']>>)
            .refine((form) => form.forbidden === true || form.example !== undefined, {
                message: 'A suppression that gspot accepts shows an example with a reason.',
                path: ['example'],
            })
            .optional(),
        prettier: z
            .strictObject({
                entry: z.string().min(1),
                // The file types the plugin formats; a configuration whose files take plugins owns them while the selection includes this tool.
                extensions: z.array(z.string().regex(EXTENSION_PATTERN)).default([]),
                overrides: z
                    .array(
                        z.strictObject({
                            files: z.string().min(1),
                            options: z.record(z.string(), z.unknown()),
                        } satisfies SchemaShape<NonNullable<Tool['prettier']>['overrides'][number]>),
                    )
                    .default([]),
            } satisfies SchemaShape<NonNullable<Tool['prettier']>>)
            .optional(),
        // The file types an ESLint plugin or parser lints; a configuration whose files take plugins owns them while the selection includes it.
        eslint: z
            .strictObject({ extensions: z.array(z.string().regex(EXTENSION_PATTERN)).min(1) } satisfies SchemaShape<
                NonNullable<Tool['eslint']>
            >)
            .optional(),
        requires: z.array(z.string().min(1)).optional(),
        when: z
            .union([toolConditionSchema, z.array(toolConditionSchema).min(1)])
            .transform((conditions) => (Array.isArray(conditions) ? conditions : [conditions]))
            .optional(),
        replace: z.array(z.string().min(1)).optional(),
        replace_key: z
            .array(
                z
                    .discriminatedUnion('pointer', [
                        replacementSchema.extend({ pointer: z.literal(false).optional() } satisfies SchemaShape<{
                            pointer?: false | undefined;
                        }>),
                        replacementSchema.extend({
                            file: z.literal('package.json'),
                            key: z.string().min(1),
                            pointer: z.literal(true),
                        } satisfies SchemaShape<{ file: 'package.json'; key: string; pointer: true }>),
                    ])
                    .refine(
                        (row) => (row.key === undefined) !== (row.table === undefined),
                        'A replace_key record selects one key or table.',
                    ),
            )
            .optional(),
        ...installerFields,
    })
    .transform(({ npm, pypi, mise, ...tool }) => {
        const definitions = { npm, pypi, mise };
        const installers: Record<string, InstallerPin> = {};
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition === undefined) continue;
            installers[name] =
                typeof definition === 'string'
                    ? stripUndefined({ name: definition, version: tool.version })
                    : definition;
        }
        return { ...stripUndefined(tool), installers };
    }) satisfies z.ZodType<Tool>;

/** A record with only a name points to the full declaration in another configuration. */
export const manifestToolSchema = z.union([
    z
        .looseObject({ name: z.string() } satisfies SchemaShape<{ name: string }>)
        .refine((reference) => Object.keys(reference).length === 1, {
            abort: true,
            message: 'A tool reference contains only its name.',
        })
        .transform(({ name }) => name),
    toolSchema,
]) satisfies z.ZodType<string | Tool>;
