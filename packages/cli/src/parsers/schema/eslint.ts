import { z } from 'zod';
import type { EslintPresets } from '#cli/types/parsers/eslint.ts';

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

export const eslintCoverageRequestSchema = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
});
export const eslintCoverageResponseSchema = z.record(z.string(), z.array(z.string()));

export const workerArgumentsSchema = z.tuple([z.string().min(1), z.string().min(1)]);

export const eslintRuleSettingsSchema = z.record(z.string(), z.unknown());

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

/** Resolved rules returned by ESLint for one source path. */
export const eslintResolvedConfigurationSchema = z.object({ rules: eslintRuleSettingsSchema.optional() }).optional();
