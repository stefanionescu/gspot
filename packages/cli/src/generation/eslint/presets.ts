import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { eslintPresetSchema } from '#cli/configurations/schema/manifest.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';

import {
    type EslintModule,
    type EslintPresets,
    type FragmentPreset,
    type EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

const eslintPresetsSchema = z.record(z.string(), eslintPresetSchema) satisfies z.ZodType<EslintPresets>;

/**
 * Select emitted preset properties without its parser-detection flag.
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
 * Build the blocks of one pinned preset with the caller's rule and parser choices.
 * @param preset the pinned export and all configuration blocks it contains.
 * @param importName the JavaScript identifier for the preset package import.
 * @param transform the transformation that retains each block and its runtime source expression.
 * @returns the transformed preset blocks with their runtime source expressions.
 */
function buildPresetBlocks(
    preset: Pick<FragmentPreset, 'source'> & { blocks: readonly FragmentPreset['blocks'][number][] },
    importName: string,
    transform: (
        block: FragmentPreset['blocks'][number],
        index: number,
        source: string,
    ) => Parameters<EslintModule['block']>,
): Parameters<EslintModule['block']>[] {
    const source = serializePresetAccess(importName, preset.source);
    return preset.blocks.map((block, index) => transform(block, index, source));
}

/**
 * Retain each array preset block's runtime spread while applying its component-specific fields.
 * @param preset the pinned array preset.
 * @param importName the imported plugin identifier.
 * @param transform the component's rule or file-field transformation.
 * @returns the blocks with their installed preset expressions.
 */
function buildArrayPresetBlocks(
    preset: FragmentPreset,
    importName: string,
    transform: (block: FragmentPreset['blocks'][number]) => EslintSettingsBlock,
): Parameters<EslintModule['block']>[] {
    return buildPresetBlocks(preset, importName, (block, index, source) => [
        transform(block),
        `...${source}[${String(index)}]`,
        { expression: `${source}[${String(index)}].rules`, rules: block.rules },
    ]);
}

/**
 * Keep component preset fields and raise warning rules to errors.
 * @param block the captured component preset block.
 * @returns its emitted fields with warning severities promoted.
 */
function promotePresetRules(block: FragmentPreset['blocks'][number]): EslintSettingsBlock {
    return {
        ...pickPresetFields(block),
        ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
    };
}

export { readPresets, pickPresetFields, buildPresetBlocks, promotePresetRules, buildArrayPresetBlocks };
