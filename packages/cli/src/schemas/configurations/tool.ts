import { z } from 'zod';
import semver from 'semver';
import { stripUndefined } from '#cli/system/tables.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { MAX_EXIT_CODE } from '#cli/config/configurations/fields.ts';
import { TOOL_KINDS, TOOL_BUILDS } from '#cli/config/configurations/names.ts';
import { EXTENSION_PATTERN, MINIMUM_VERSION_PATTERN } from '#cli/config/configurations/tool.ts';
import { regexSchema, commandSchema, conditionSchema } from '#cli/schemas/configurations/fields.ts';

const minimumVersionSchema = z
    .string()
    .regex(MINIMUM_VERSION_PATTERN)
    .transform((minimum, context) => {
        const version = semver.coerce(minimum);
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

const miseInstallerSchema = z.union([
    z.string(),
    installerDefinition.partial({ version: true }).extend({
        options: installerOptionsSchema.optional(),
    } satisfies SchemaShape<{
        options?: Record<string, string | boolean> | undefined;
    }>),
]) satisfies z.ZodType<
    string | { name: string; version?: string | undefined; options?: Record<string, string | boolean> | undefined }
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
const overridesSchema = z.strictObject({
    files: z.string().min(1),
    options: z.record(z.string(), z.unknown()),
} satisfies SchemaShape<NonNullable<Tool['prettier']>['overrides'][number]>);
const replacementKeySchema = z.discriminatedUnion('pointer', [
    replacementSchema.extend({ pointer: z.literal(false).optional() } satisfies SchemaShape<{
        pointer?: false | undefined;
    }>),
    replacementSchema.extend({
        file: z.literal('package.json'),
        key: z.string().min(1),
        pointer: z.literal(true),
    } satisfies SchemaShape<{ file: 'package.json'; key: string; pointer: true }>),
]) satisfies z.ZodType<NonNullable<Tool['replace_key']>[number]>;

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
            } satisfies SchemaShape<NonNullable<Tool['suppression']>>)
            .refine((form) => form.forbidden === true || form.example !== undefined, {
                message: 'A suppression that gspot accepts shows an example with a reason.',
                path: ['example'],
            })
            .optional(),
        prettier: z
            .strictObject({
                module: z.string().min(1),
                extensions: z.string().regex(EXTENSION_PATTERN).array().default([]),
                overrides: overridesSchema.array().default([]),
            } satisfies SchemaShape<NonNullable<Tool['prettier']>>)
            .optional(),
        eslint: z
            .strictObject({ extensions: z.string().regex(EXTENSION_PATTERN).array().min(1) } satisfies SchemaShape<
                NonNullable<Tool['eslint']>
            >)
            .optional(),
        requires: z.string().min(1).array().optional(),
        when: z
            .union([toolConditionSchema, toolConditionSchema.array().min(1)])
            .transform((conditions) => (Array.isArray(conditions) ? conditions : [conditions]))
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
                context.addIssue({ code: 'custom', path: [name], message: 'This installer needs an exact version.' });
        }
    })
    .transform(({ npm, pypi, mise, ...tool }) => {
        const definitions = { npm, pypi, mise };
        const installers: Tool['installers'] = {};
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition === undefined) continue;
            const pin = stripUndefined(
                typeof definition === 'string'
                    ? { name: definition, version: tool.version }
                    : { ...definition, version: definition.version ?? tool.version },
            );
            installers[name] = name === 'npm' ? pin : { ...pin, version: pin.version };
        }
        return { ...stripUndefined(tool), installers };
    }) satisfies z.ZodType<Tool>;

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
