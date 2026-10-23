import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import { eslintPresetsSchema } from '#cli/schemas/generation.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { serializePresetAccess } from '#cli/generation/configurations/language/javascript/eslint/print.ts';

import {
    TABINDEX_RULES,
    FOCUSABLE_ROLES,
    ESLINT_PRESETS_FILE,
} from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';
import type {
    EslintPreset,
    EslintPresets,
    EslintBlockFields,
    ConfigurationBlocks,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

/**
 * Turn enabled warnings into errors, and keep every preset option.
 *
 * @param rules what a pinned preset sets.
 *
 * @returns the lint rules as errors, and the ones that stay off.
 */
export function convertWarningsToErrors(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, ruleSetting]) => {
            const values: unknown[] = Array.isArray(ruleSetting) ? ruleSetting : [ruleSetting];
            const [level, ...options] = values;
            return [rule, level === 'off' || level === 0 ? 'off' : ['error', ...options]];
        }),
    );
}

/**
 * Read the pinned presets shipped beside their configuration.
 *
 * @param configuration the configuration owning the preset.
 * @returns preset blocks without executable plugin or parser objects.
 */
export function readPresets(configuration: Configuration): EslintPresets {
    return eslintPresetsSchema.parse(
        JSON.parse(readFileSync(buildAssetPath(`${configuration.folder}/${ESLINT_PRESETS_FILE}`), 'utf8')),
    );
}

/**
 * Get a required preset and report a missing shipped export.
 *
 * @param presets the captured exports of the configuration.
 * @param name the required export.
 * @returns the captured preset.
 */
export function getPreset(presets: EslintPresets | undefined, name: string): EslintPreset {
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
export function buildArrayPresetBlocks(
    preset: EslintPreset,
    importName: string,
    transform: (block: EslintPreset['blocks'][number]) => EslintBlockFields,
): ConfigurationBlocks['blocks'] {
    const source = serializePresetAccess(importName, preset.source);
    return preset.blocks.map((block, index) => ({
        fields: transform(block),
        properties: `...${source}[${String(index)}]`,
        preset: { expression: `${source}[${String(index)}].rules`, rules: block.rules },
    }));
}

/**
 * Merge first-block preset rules and their runtime expressions in the same order.
 *
 * @param presets imported bindings paired with captured presets.
 * @returns the combined rule expression and captured rule values.
 */
export function buildPresetRuleExpression(presets: (readonly [string, EslintPreset])[]): EslintRuleExpression {
    const sources = presets.map(
        ([importName, preset]) => '...' + serializePresetAccess(importName, preset.source) + '.rules',
    );
    return {
        expression: '{ ' + sources.join(', ') + ' }',
        rules: Object.fromEntries(
            presets.flatMap(([, preset]) => {
                const rules = preset.blocks[0].rules;
                return rules === undefined ? [] : Object.entries(rules);
            }),
        ),
    };
}

/**
 * Add fixed options while retaining a rule's severity and existing options.
 *
 * @param ruleSetting the pinned severity and its current parameters.
 * @param options the rule-specific values that replace existing options.
 * @returns the rule with the added options, or the unchanged non-array entry.
 */
export function addRuleOptions(ruleSetting: unknown, options: Record<string, unknown>): unknown {
    if (!Array.isArray(ruleSetting)) return ruleSetting;
    const severity: unknown = ruleSetting[0];
    const previous: unknown = ruleSetting[1];
    return [severity, Object.assign({}, previous, options)];
}

/**
 * Allow keyboard focus on scrollable regions in accessibility presets.
 *
 * @param rules the captured jsx-a11y rules.
 * @returns the rules with region roles permitted by tabindex checks.
 */
export function allowFocusableRegions(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, ruleSetting]) => [
            rule,
            (TABINDEX_RULES as readonly string[]).includes(rule)
                ? addRuleOptions(ruleSetting, { roles: [...FOCUSABLE_ROLES] })
                : ruleSetting,
        ]),
    );
}

/**
 * Keep component preset fields and raise warning rules to errors.
 *
 * @param block one captured component preset.
 * @returns its fields, with warnings turned into errors.
 */
export function convertPresetWarnings(block: EslintPreset['blocks'][number]): EslintBlockFields {
    const { parser: _parser, ...fields } = block;
    return {
        ...fields,
        ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
    };
}
