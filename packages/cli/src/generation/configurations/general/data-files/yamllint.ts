import { stringify } from 'yaml';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    YAMLLINT_RULES,
    YAMLLINT_YAML_OPTIONS,
    YAMLLINT_RULE_OPTIONS,
} from '#cli/config/generation/configurations/general/data-files/yamllint.ts';

/**
 * Build yamllint.yml: the YAML lint rules with the configured indentation and disabled checks.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the YAML lint rules with the configured indentation and disabled checks.
 */
export function buildYamllintFile(planned: PlannedConfigFile): string {
    const rules: Record<string, unknown> = {
        ...Object.fromEntries(YAMLLINT_RULES.map((rule) => [rule, {}])),
        ...YAMLLINT_RULE_OPTIONS,
    };
    for (const [rule, chosen] of Object.entries(getTable(planned.scope.settings, 'tools.yamllint').rules))
        rules[rule] = { ...(rules[rule] as Record<string, unknown>), ...chosen };
    Object.assign(
        rules,
        Object.fromEntries(listIgnoredRules(planned.scope, 'data-files/yamllint').map((name) => [name, 'disable'])),
    );
    const document = { rules };
    return stringify(document, YAMLLINT_YAML_OPTIONS);
}
