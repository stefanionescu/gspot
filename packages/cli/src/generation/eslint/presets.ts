import { readAsset } from '#cli/system/assets.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { eslintPresetsSchema } from '#cli/schemas/generation.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { TABINDEX_RULES, FOCUSABLE_ROLES } from '#cli/config/generation/eslint-fragments.ts';

import type {
    EslintPreset,
    EslintPresets,
    EslintFragment,
    EslintSettingsBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

/**
 * Read the pinned presets shipped beside their configuration.
 *
 * @param manifest the configuration owning the preset.
 * @returns preset blocks without executable plugin or parser objects.
 */
function readPresets(manifest: Manifest): EslintPresets {
    return eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.folder}/${ESLINT_PRESETS_FILE}`)));
}

/**
 * Get a required preset and report a missing shipped export.
 *
 * @param presets the captured exports of the configuration.
 * @param name the required export.
 * @returns the captured preset.
 */
function getPreset(presets: EslintPresets | undefined, name: string): EslintPreset {
    const preset = presets?.[name];
    if (preset === undefined) throw new Error(`The configuration ships no ${name} preset.`);
    return preset;
}

/**
 * Preserve every array preset spread while transforming its captured fields.
 *
 * @param preset the pinned array export.
 * @param importName its imported binding.
 * @param transform the rules and file fields of each block.
 * @returns the changed blocks with their runtime expressions.
 */
function buildArrayPresetBlocks(
    preset: EslintPreset,
    importName: string,
    transform: (block: EslintPreset['blocks'][number]) => EslintSettingsBlock,
): EslintFragment['blocks'] {
    const source = serializePresetAccess(importName, preset.source);
    return preset.blocks.map((block, index) => ({
        data: transform(block),
        properties: `...${source}[${String(index)}]`,
        preset: { expression: `${source}[${String(index)}].rules`, rules: block.rules },
    }));
}

/**
 * Merge first-block preset rules and their runtime expressions in the same order.
 *
 * @param entries imported bindings paired with captured presets.
 * @returns the combined rule expression and captured rule values.
 */
function buildPresetRuleExpression(entries: (readonly [string, EslintPreset])[]): EslintRuleExpression {
    const sources = entries.map(
        ([importName, preset]) => '...' + serializePresetAccess(importName, preset.source) + '.rules',
    );
    return {
        expression: '{ ' + sources.join(', ') + ' }',
        rules: Object.fromEntries(
            entries.flatMap(([, preset]) => {
                const rules = preset.blocks[0].rules;
                return rules === undefined ? [] : Object.entries(rules);
            }),
        ),
    };
}

/**
 * Add fixed options while retaining a rule's severity and existing options.
 *
 * @param entry the pinned severity and its current parameters.
 * @param options the rule-specific values that replace existing options.
 * @returns the rule with the added options, or the unchanged non-array entry.
 */
function addRuleOptions(entry: unknown, options: Record<string, unknown>): unknown {
    if (!Array.isArray(entry)) return entry;
    const severity: unknown = entry[0];
    const previous: unknown = entry[1];
    return [severity, Object.assign({}, previous, options)];
}

/**
 * Allow keyboard focus on scrollable regions in accessibility presets.
 *
 * @param rules the captured jsx-a11y rules.
 * @returns the rules with region roles permitted by tabindex checks.
 */
function allowFocusableRegions(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => [
            rule,
            (TABINDEX_RULES as readonly string[]).includes(rule)
                ? addRuleOptions(entry, { roles: [...FOCUSABLE_ROLES] })
                : entry,
        ]),
    );
}

/**
 * Keep component preset fields and raise warning rules to errors.
 *
 * @param block one captured component preset.
 * @returns its fields, with warnings turned into errors.
 */
function promotePresetRules(block: EslintPreset['blocks'][number]): EslintSettingsBlock {
    const { parser: _parser, ...fields } = block;
    return {
        ...fields,
        ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
    };
}

export {
    getPreset,
    readPresets,
    addRuleOptions,
    promotePresetRules,
    allowFocusableRegions,
    buildArrayPresetBlocks,
    buildPresetRuleExpression,
};
