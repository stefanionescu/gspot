import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { eslintPresetSchema } from '#cli/configurations/schema/manifest.ts';
import { ESLINT_PRESETS_FILE, PACKAGE_JSON_PATTERN } from '#cli/config/generation/eslint.ts';
import { type EslintModule, type EslintPresets, type EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;

/**
 * Select emitted preset properties without its parser-detection flag.
 *
 * @param block the captured preset metadata.
 *
 * @returns the native rule and file properties.
 */
function pickPresetFields(block: EslintSettingsBlock | EslintPresets[string]['blocks'][number]): EslintSettingsBlock {
    return {
        ...(block.files === undefined ? {} : { files: block.files }),
        ...(block.ignores === undefined ? {} : { ignores: block.ignores }),
        ...(block.basePath === undefined ? {} : { basePath: block.basePath }),
        ...(block.rules === undefined ? {} : { rules: block.rules }),
    };
}

/**
 * Read the exact pinned presets shipped beside their configuration.
 *
 * @param manifest the configuration owning the preset.
 *
 * @returns preset blocks without executable plugin or parser objects.
 */
function readPresets(manifest: Manifest): EslintPresets {
    const parsed = eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.dir}/${ESLINT_PRESETS_FILE}`)));
    return Object.fromEntries(
        Object.entries(parsed).map(([name, preset]) => [
            name,
            { ...preset, blocks: preset.blocks.map((block) => stripUndefined(block)) },
        ]),
    );
}

/**
 * Build the blocks of one pinned preset with the caller's rule and parser choices.
 * @param presets the pinned export and all configuration blocks it contains.
 * @param sources the JavaScript identifier for the preset package import.
 * @param codeFiles the transformation that retains each block and its runtime source expression.
 * @returns the transformed preset blocks with their runtime source expressions.
 */
function buildPresetBlocks(
    presets: EslintPresets,
    sources: readonly (readonly [string, string])[],
    codeFiles: string[],
): Parameters<EslintModule['block']>[] {
    return sources.map(([name, variable]) => {
        const selected = presets[name] as EslintPresets[string];
        const preset = pickPresetFields(selected.blocks[0] as EslintPresets[string]['blocks'][number]);
        const files = name === 'packageJson' ? [PACKAGE_JSON_PATTERN] : codeFiles;
        const source = serializePresetAccess(variable, selected.source);
        return [
            stripUndefined({ ...preset, files }),
            `...${source}`,
            { expression: `${source}.rules`, rules: preset.rules },
        ];
    });
}

export { buildPresetBlocks };
export { readPresets, pickPresetFields };
