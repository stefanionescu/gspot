import { z } from 'zod';
import { compact } from '#cli/objects.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { ToolInput, ToolFields, InstallerPin, ToolDeclaration } from '#cli/types/configurations.ts';
import { regexSchema, commandSchema, conditionSchema, versionFloorSchema } from '#cli/configurations/schema/parts.ts';

import {
    TOOL_KINDS,
    TOOL_BUILDS,
    MAX_EXIT_CODE,
    RULE_PLACEHOLDER,
    EXTENSION_PATTERN,
} from '#cli/config/configurations.ts';

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
    brew: installerSchema.optional(),
    apt: installerSchema.optional(),
    cargo: installerSchema.optional(),
    github: installerSchema.optional(),
    winget: installerSchema.optional(),
    scoop: installerSchema.optional(),
};

const toolConditionSchema = conditionSchema.pick({ setting: true, level: true }).partial() satisfies z.ZodType<
    NonNullable<ToolDeclaration['when']>[number]
>;

const replacementSchema = z.strictObject({
    file: z.string().min(1),
    table: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    shared: z.boolean().default(false),
} satisfies SchemaShape<{ file: string; table?: string | undefined; key?: string | undefined; shared: boolean }>);

const toolSchema = z
    .strictObject({
        name: z.string(),
        kind: z.enum(TOOL_KINDS).default('program'),
        version: z.string().optional(),
        min_version: versionFloorSchema.optional(),
        install_hint: z.string().min(1).optional(),
        system: z.boolean().optional(),
        // The platforms the tool has a build for; unset means every platform.
        builds: z.array(z.enum(TOOL_BUILDS)).min(1).optional(),
        version_command: commandSchema.optional(),
        version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
        version_pattern: z.string().optional(),
        // Output that means the tool fell over rather than found something, for every check that runs it.
        crash_pattern: regexSchema.optional(),
        // Header lines omitted when a per-file command reports an unstructured failure.
        diagnostic_header_pattern: regexSchema.optional(),
        // Where the tool documents one rule; explain prints it with the rule name in place of `{rule}`.
        rule_url: z.string().includes(RULE_PLACEHOLDER, { message: 'A rule page names where {rule} goes.' }).optional(),
        rule_prefix: z.string().min(1).optional(),
        suppression: z
            .strictObject({
                marker: regexSchema,
                inline_marker: regexSchema.optional(),
                reason: regexSchema,
                forbidden: z.boolean().optional(),
            } satisfies SchemaShape<NonNullable<ToolDeclaration['suppression']>>)
            .optional(),
        env: z.record(z.string(), z.string()).optional(),
        refused_options: z
            .array(
                z.strictObject({
                    paths: z
                        .array(
                            z
                                .string()
                                .refine(
                                    (path) => path.split('.').every((part) => /^[a-z][\w-]*$/iu.test(part)),
                                    'Use a dotted tool option path.',
                                ),
                        )
                        .min(1),
                    message: z.string().min(1),
                } satisfies SchemaShape<NonNullable<ToolDeclaration['refused_options']>[number]>),
            )
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
                        } satisfies SchemaShape<NonNullable<ToolDeclaration['prettier']>['overrides'][number]>),
                    )
                    .default([]),
            } satisfies SchemaShape<NonNullable<ToolDeclaration['prettier']>, NonNullable<ToolInput['prettier']>>)
            .optional(),
        // The file types an ESLint plugin or parser lints; a configuration whose files take plugins owns them while the selection includes it.
        eslint: z
            .strictObject({ extensions: z.array(z.string().regex(EXTENSION_PATTERN)).min(1) } satisfies SchemaShape<
                NonNullable<ToolDeclaration['eslint']>
            >)
            .optional(),
        requires: z.array(z.string().min(1)).optional(),
        when: z
            .union([toolConditionSchema, z.array(toolConditionSchema).min(1)])
            .transform((conditions) => (Array.isArray(conditions) ? conditions : [conditions]))
            .optional(),
        replace: z
            .array(
                z
                    .discriminatedUnion('redirect', [
                        replacementSchema.extend({ redirect: z.literal(false).optional() } satisfies SchemaShape<{
                            redirect?: false | undefined;
                        }>),
                        replacementSchema.extend({
                            file: z.literal('package.json'),
                            key: z.string().min(1),
                            redirect: z.literal(true),
                        } satisfies SchemaShape<{ file: 'package.json'; key: string; redirect: true }>),
                    ])
                    .superRefine((row, context) => {
                        if (row.key !== undefined && row.table !== undefined)
                            context.addIssue({
                                code: 'custom',
                                message: 'A replace row selects either a key or a table.',
                            });
                        if ((row.key !== undefined || row.table !== undefined) && !row.shared)
                            context.addIssue({
                                code: 'custom',
                                message: 'A selected key or table must preserve its shared file.',
                            });
                    }),
            )
            .optional(),
        ...installerFields,
    } satisfies SchemaShape<ToolFields, ToolInput>)
    .transform(({ npm, pypi, mise, brew, apt, cargo, github, winget, scoop, ...tool }) => {
        const definitions = { npm, pypi, mise, brew, apt, cargo, github, winget, scoop };
        const installers: Record<string, InstallerPin> = {};
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition === undefined) continue;
            installers[name] =
                typeof definition === 'string' ? compact({ name: definition, version: tool.version }) : definition;
        }
        return { ...compact(tool), installers };
    }) satisfies z.ZodType<ToolDeclaration, ToolInput>;

/** A name-only row refers to the complete declaration in another configuration. */
export const toolDeclarationSchema = z.union([
    z
        .looseObject({ name: z.string() } satisfies SchemaShape<{ name: string }>)
        .refine((reference) => Object.keys(reference).length === 1, {
            abort: true,
            message: 'A tool reference contains only its name.',
        })
        .transform(({ name }) => name),
    toolSchema,
]) satisfies z.ZodType<string | ToolDeclaration, { name: string } | ToolInput>;
