import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint.ts';
import { eslintPresetSchema } from '#cli/configurations/schema/manifest.ts';
import type { EslintPresets, EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;

/**
 * Select emitted preset properties without its parser-detection flag.
 *
 * @param block the captured preset metadata.
 *
 * @returns the native rule and file properties.
 */
export function presetBlock(block: EslintSettingsBlock | EslintPresets[string]['blocks'][number]): EslintSettingsBlock {
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
export function readPresets(manifest: Manifest): EslintPresets {
    const parsed = eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.dir}/${ESLINT_PRESETS_FILE}`)));
    return Object.fromEntries(
        Object.entries(parsed).map(([name, preset]) => [
            name,
            { ...preset, blocks: preset.blocks.map((block) => stripUndefined(block)) },
        ]),
    );
}
