import {
    TABINDEX_RULES,
    FOCUSABLE_ROLES,
} from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';
import type {
    EslintPreset,
    EslintPresets,
    EslintBlockFields,
    EslintPresetRules,
    ConfigurationBlocks,
} from '#cli/types/generation/eslint.ts';

/**
Turn enabled warnings into errors, and keep every preset option.

@param rules what a pinned preset sets.
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
Get a required preset and report a missing shipped export.

@param presets the captured exports of the configuration.
@param name the required export.
*/
export function getPreset(presets: EslintPresets | undefined, name: string): EslintPreset {
    const preset = presets?.[name];
    if (preset === undefined) throw new Error(`The configuration ships no ${name} preset.`);
    return preset;
}

/**
Preserve every array preset spread while transforming its captured fields.

@param preset the pinned array export.
@param importName its imported binding.
@param transform the rules and file fields of each block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildArrayPresetBlocks(
    preset: EslintPreset,
    importName: string,
    transform: (block: EslintPreset['blocks'][number]) => EslintBlockFields,
): ConfigurationBlocks['blocks'] {
    return preset.blocks.map((block, index) => ({
        fields: transform(block),
        preset: {
            sources: [{ importName: importName, path: `${preset.source}.${String(index)}`, includeFields: true }],
            rules: block.rules,
        },
    }));
}

/**
Merge first-block preset rules and their runtime expressions in the same order.

@param presets imported bindings paired with captured presets.
@returns the combined rule expression and captured rule values.
*/
export function buildPresetRules(presets: (readonly [string, EslintPreset])[]): EslintPresetRules {
    return {
        sources: presets.map(([importName, preset]) => ({ importName, path: preset.source })),
        rules: Object.fromEntries(
            presets.flatMap(([, preset]) => {
                const rules = preset.blocks[0].rules;
                return rules === undefined ? [] : Object.entries(rules);
            }),
        ),
    };
}

/**
Add fixed options while retaining a rule's severity and existing options.

@param ruleSetting the pinned severity and its current parameters.
@param options the rule-specific values that replace existing options.
@returns the rule with the added options, or the unchanged non-array entry.
*/
export function mergeRuleOptions(ruleSetting: unknown, options: Record<string, unknown>): unknown {
    if (!Array.isArray(ruleSetting)) return ruleSetting;
    const severity: unknown = ruleSetting[0];
    const previous: unknown = ruleSetting[1];
    return [severity, Object.assign({}, previous, options)];
}

/**
Allow keyboard focus on the supported region roles while retaining each preset's severity and other options.

@param rules the accessibility rules from the pinned preset.
*/
export function setFocusableRoles(rules: Record<string, unknown>): Record<string, unknown> {
    const configured = { ...rules };
    for (const rule of TABINDEX_RULES)
        if (Object.hasOwn(configured, rule))
            configured[rule] = mergeRuleOptions(configured[rule], { roles: [...FOCUSABLE_ROLES] });
    return configured;
}
