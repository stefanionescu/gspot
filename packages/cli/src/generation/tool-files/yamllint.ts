import { stringify } from 'yaml';
import type { ScopeView } from '#cli/types/settings/values.ts';

import {
    YAMLLINT_RULES,
    YAMLLINT_YAML_OPTIONS,
    YAMLLINT_RULE_OPTIONS,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the yamllint configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 * @param root0.rulesOff the disabled lint rule reader.
 *
 * @returns the generated configuration text.
 */
export function buildYamllintFile({ settings, rulesOff }: Pick<ScopeView, 'settings' | 'rulesOff'>): string {
    const rules: Record<string, unknown> = {
        ...Object.fromEntries(YAMLLINT_RULES.map((rule) => [rule, {}])),
        ...YAMLLINT_RULE_OPTIONS,
    };
    for (const [rule, chosen] of Object.entries(
        settings['tools.yamllint.rules'] as Record<string, Record<string, unknown>>,
    ))
        rules[rule] = { ...(rules[rule] as Record<string, unknown>), ...chosen };
    Object.assign(rules, Object.fromEntries(rulesOff('files/yamllint').map((name) => [name, 'disable'])));
    const document = { rules };
    return stringify(document, YAMLLINT_YAML_OPTIONS).trimEnd();
}
