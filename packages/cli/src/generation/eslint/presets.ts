import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { eslintPresetSchema } from '#cli/configurations/schema/manifest.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';

import {
    type BlockWriter,
    type EslintPresets,
    type FragmentPreset,
    type EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;

/**
 * Pick the preset fields to generate, without the parser-detection flag.
 *
 * @param block the captured preset metadata.
 *
 * @returns the rule and file properties.
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
    const parsed = eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.folder}/${ESLINT_PRESETS_FILE}`)));
    return Object.fromEntries(
        Object.entries(parsed).map(([name, preset]) => [
            name,
            { ...preset, blocks: preset.blocks.map((block) => stripUndefined(block)) },
        ]),
    );
}

/**
 * Build the blocks of one pinned preset with a rule and parser transform.
 * @param preset the pinned export and its blocks.
 * @param importName the JavaScript binding of the preset package.
 * @param transform changes each block, and keeps its runtime source expression.
 * @returns the changed blocks with their runtime source expressions.
 */
function buildPresetBlocks(
    preset: Pick<FragmentPreset, 'source'> & { blocks: readonly FragmentPreset['blocks'][number][] },
    importName: string,
    transform: (
        block: FragmentPreset['blocks'][number],
        index: number,
        source: string,
    ) => Parameters<BlockWriter['block']>,
): Parameters<BlockWriter['block']>[] {
    const source = serializePresetAccess(importName, preset.source);
    return preset.blocks.map((block, index) => transform(block, index, source));
}

/**
 * Keep the runtime spread of each array preset block, and apply its component fields.
 * @param preset the pinned array export.
 * @param importName the JavaScript binding of the plugin.
 * @param transform changes the rules or file fields of a block.
 * @returns the blocks with their installed preset expressions.
 */
function buildArrayPresetBlocks(
    preset: FragmentPreset,
    importName: string,
    transform: (block: FragmentPreset['blocks'][number]) => EslintSettingsBlock,
): Parameters<BlockWriter['block']>[] {
    return buildPresetBlocks(preset, importName, (block, index, source) => [
        transform(block),
        `...${source}[${String(index)}]`,
        { expression: `${source}[${String(index)}].rules`, rules: block.rules },
    ]);
}

/**
 * Keep component preset fields and raise warning rules to errors.
 * @param block one captured component preset.
 * @returns its fields, with warnings turned into errors.
 */
function promotePresetRules(block: FragmentPreset['blocks'][number]): EslintSettingsBlock {
    return {
        ...pickPresetFields(block),
        ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
    };
}

export { readPresets, pickPresetFields, buildPresetBlocks, promotePresetRules, buildArrayPresetBlocks };
