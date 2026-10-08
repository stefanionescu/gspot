import { z } from 'zod';
import semver from 'semver';
import { compact } from '#cli/platform/contracts.ts';
import type { InstallerPin } from '#cli/types/parsers/tool.ts';
import { commandSchema } from '#cli/parsers/schema/command.ts';
import { MAX_EXIT_CODE } from '#cli/config/platform/runtime.ts';
import type { EslintPresets } from '#cli/types/parsers/eslint.ts';
import { VERSION_FLOOR } from '#cli/config/parsers/tool/version.ts';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';

const installerDefinition = z.strictObject({ name: z.string(), version: z.string() });

const installerSchema = z.union([z.string(), installerDefinition]);

const installerOptionsSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

const installerConstraintsSchema = z.array(z.string().regex(/^[a-z0-9._-]+(?:[<>!~=]=|[<>])[a-z0-9.*+!_-]+$/iu)).min(1);

// Options mise writes beside the version, such as no_app or rename_exe for a release that ships an app bundle.
const miseInstallerSchema = z.union([
    z.string(),
    installerDefinition.extend({ options: installerOptionsSchema.optional() }),
]);

// A floor a gspot maintainer raises on a package a Python tool pulls in, such as one above an advisory. Each is a
// name, one comparison, and a version, as uv takes it.
const pypiInstallerSchema = z.union([
    z.string(),
    installerDefinition.extend({
        constraints: installerConstraintsSchema.optional(),
    }),
]);

const installerFields = {
    npm: installerSchema.optional(),
    pypi: pypiInstallerSchema.optional(),
    mise: miseInstallerSchema.optional(),
    brew: installerSchema.optional(),
    apt: installerSchema.optional(),
    cargo: installerSchema.optional(),
    github: installerSchema.optional(),
    winget: installerSchema.optional(),
    scoop: installerSchema.optional(),
};

const suppressionPattern = z
    .string()
    .min(1)
    .refine((value) => {
        try {
            new RegExp(value, 'u');
            return true;
        } catch {
            return false;
        }
    }, 'Expected a valid Unicode regular expression.');

const requirementSchema = z.object({ name: z.string(), specifier: z.string() });

/** Installer strings inherit the tool version; explicit definitions retain their own version. */
export const installerPinSchema = installerDefinition.partial({ version: true }).extend({
    options: installerOptionsSchema.optional(),
    constraints: installerConstraintsSchema.optional(),
});

/** Native floors normalize at the manifest boundary before version comparisons. */
export const versionFloorSchema = z
    .string()
    .regex(VERSION_FLOOR)
    .transform((floor, context) => {
        const version = semver.coerce(floor);
        if (version === null) {
            context.addIssue({ code: 'custom', message: 'Use a numeric native version floor.' });
            return z.NEVER;
        }
        return version.version;
    });

export const toolSchema = z
    .strictObject({
        name: z.string(),
        kind: z.enum(['binary', 'library']).default('binary'),
        version: z.string().optional(),
        min_version: versionFloorSchema.optional(),
        system: z.boolean().optional(),
        // The platforms the tool has a build for; unset means every platform.
        platforms: z
            .array(
                z.enum(
                    OPERATING_SYSTEMS.flatMap(
                        (system) => [system.name, `${system.name}-x64`, `${system.name}-arm64`] as const,
                    ),
                ),
            )
            .min(1)
            .optional(),
        version_command: commandSchema.optional(),
        version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
        version_pattern: z.string().optional(),
        // Output that means the tool fell over rather than found something, for every check that runs it.
        crash_pattern: suppressionPattern.optional(),
        // Header lines omitted when a per-file command reports an unstructured failure.
        diagnostic_header_pattern: suppressionPattern.optional(),
        // Where the tool documents one rule; explain prints it with the rule name in place of `{rule}`.
        rule_url: z.string().includes('{rule}', { message: 'A rule page names where {rule} goes.' }).optional(),
        suppression: z
            .strictObject({
                marker: suppressionPattern,
                inline_marker: suppressionPattern.optional(),
                reason: suppressionPattern,
                forbidden: z.boolean().optional(),
            })
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
                                    'Use a dotted native option path.',
                                ),
                        )
                        .min(1),
                    values: z
                        .array(z.union([z.string(), z.number(), z.boolean()]))
                        .min(1)
                        .optional(),
                    message: z.string().min(1),
                }),
            )
            .optional(),
        query_packs: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/u), z.string().regex(/^\d+\.\d+\.\d+$/u)).optional(),
        prettier: z
            .strictObject({
                entry: z.string().min(1),
                // The file types the plugin formats; a configuration whose files take plugins owns them while this tool is selected.
                extensions: z.array(z.string().regex(/^\.[a-z0-9]+$/u)).default([]),
                overrides: z
                    .array(z.strictObject({ files: z.string().min(1), options: z.record(z.string(), z.unknown()) }))
                    .default([]),
            })
            .optional(),
        // The file types an ESLint plugin or parser lints; a configuration whose files take plugins owns them while it is selected.
        eslint: z.strictObject({ extensions: z.array(z.string().regex(/^\.[a-z0-9]+$/u)).min(1) }).optional(),
        replaces: z.array(z.string().min(1)).default([]),
        replace: z
            .array(
                z
                    .strictObject({
                        file: z.string().min(1),
                        table: z.string().min(1).optional(),
                        key: z.string().min(1).optional(),
                        shared: z.boolean().default(false),
                    })
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
    })
    .transform(({ npm, pypi, mise, brew, apt, cargo, github, winget, scoop, replaces, ...tool }) => {
        const definitions = { npm, pypi, mise, brew, apt, cargo, github, winget, scoop };
        const installers: Record<string, InstallerPin> = {};
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition === undefined) continue;
            installers[name] =
                typeof definition === 'string' ? compact({ name: definition, version: tool.version }) : definition;
        }
        if (replaces.length > 0)
            tool.replace = [...replaces.map((file) => ({ file, shared: false })), ...(tool.replace ?? [])];
        return { ...compact(tool), installers };
    });

/** A name-only row refers to the complete declaration in another configuration. */
export const toolDeclarationSchema = z
    .record(z.string(), z.unknown())
    .transform((row) => (Object.keys(row).length === 1 && 'name' in row ? row['name'] : row))
    .pipe(z.union([z.string(), toolSchema]));

export const typeScriptConfigSchema = z.looseObject({ compilerOptions: z.record(z.string(), z.unknown()).optional() });

export const pythonToolProjectSchema = z.strictObject({
    project: z.strictObject({
        name: z.literal(PYTHON_TOOL_PROJECT.name),
        version: z.literal(PYTHON_TOOL_PROJECT.version),
        'requires-python': z.literal(PYTHON_TOOL_PROJECT['requires-python']),
        dependencies: z.array(z.string().regex(/^[a-z0-9._-]+==[a-z0-9.+!_-]+$/iu)),
    }),
    tool: z.strictObject({
        uv: z.strictObject({ package: z.literal(false), 'constraint-dependencies': z.array(z.string()).default([]) }),
    }),
});

export const lockfileSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
    manifest: z.object({ constraints: z.array(requirementSchema).default([]) }).default({ constraints: [] }),
    package: z.array(
        z.object({
            name: z.string(),
            version: z.string(),
            source: z.looseObject({ virtual: z.string().optional() }),
            metadata: z
                .object({ 'requires-dist': z.array(requirementSchema).default([]) })
                .default({ 'requires-dist': [] }),
        }),
    ),
});

export const uvProjectSettingsSchema = z.object({
    tool: z.object({ uv: z.record(z.string(), z.unknown()).default({}) }).default({ uv: {} }),
});

export const uvFindLinksSchema = z.array(z.string());

export const uvIndexSchema = z.looseObject({ url: z.string() });

export const uvIndexesSchema = z.array(uvIndexSchema);

/** Only house style rules need a separate level membership check. */
export const eslintAllRulesSchema = z.array(z.string().min(1)).transform((rules) => new Set(rules));

/** Actual core rule IDs captured from the pinned ESLint release. */
export const eslintRuleNamesSchema = z.strictObject({
    package: z.literal('eslint'),
    version: z.string().min(1),
    source: z.literal('builtinRules'),
    rules: z.array(z.string().min(1)),
});

/** The installed public export read only by the explicit copy producer. */
export const eslintRuleModuleSchema = z.object({ builtinRules: z.map(z.string(), z.unknown()) });

/** JSON fields that a preset contributes to rule applicability and settings. */
export const eslintPresetBlockSchema = z.strictObject({
    files: z.array(z.union([z.string(), z.array(z.string())])).optional(),
    ignores: z.array(z.string()).optional(),
    basePath: z.string().optional(),
    parser: z.boolean(),
    rules: z.record(z.string(), z.json()).optional(),
});

/** A copy identifies its exact installed package and public preset export. */
export const eslintPresetSchema = z.strictObject({
    package: z.string(),
    version: z.string(),
    source: z.string(),
    blocks: z.array(eslintPresetBlockSchema),
});

export const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema);

export const eslintModuleSchema = z.object({ default: z.unknown() });

/** Native runtime dictionaries map each global name to its write permission. */
export const eslintGlobalsSchema = z.object({ default: z.record(z.string(), z.record(z.string(), z.boolean())) });

/**
 * Capture the actual public preset export before executable plugin objects are discarded.
 * @param packageName the owning npm package.
 * @param version the installed package version.
 * @param source the dotted public export path, with slashes retained inside keys.
 * @param module the package's default export.
 * @returns validated rule and file data from every ordered preset block.
 */
export function captureEslintPreset(
    packageName: string,
    version: string,
    source: string,
    module: unknown,
): EslintPresets[string] {
    let value = module;
    for (const key of source === '' ? [] : source.split('.')) {
        if (typeof value !== 'object' || value === null)
            throw new Error(`${packageName} has no preset export ${source}.`);
        value = Reflect.get(value, key);
    }
    const blocks = (Array.isArray(value) ? value : [value]).map((block: unknown) => {
        if (typeof block !== 'object' || block === null)
            throw new Error(`${packageName} preset ${source} must contain configuration objects.`);
        const language: unknown = Reflect.get(block, 'languageOptions');
        const payload = Object.fromEntries(
            ['files', 'ignores', 'basePath', 'rules'].flatMap((key) =>
                Reflect.get(block, key) === undefined ? [] : [[key, Reflect.get(block, key)]],
            ),
        );
        return {
            ...payload,
            parser: typeof language === 'object' && language !== null && Reflect.get(language, 'parser') !== undefined,
        };
    });
    return eslintPresetSchema.parse({ package: packageName, version, source, blocks });
}
