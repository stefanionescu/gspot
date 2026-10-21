import { stringify } from 'yaml';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { YAMLLINT_RULES, YAMLLINT_YAML_OPTIONS, YAMLLINT_RULE_OPTIONS } from '#cli/config/generation/settings.ts';

/**
 * Build the yamllint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the YAML lint rules with the configured indentation and disabled checks.
 */
function buildYamllintFile(context: ToolFileContext): string {
    const rules: Record<string, unknown> = {
        ...Object.fromEntries(YAMLLINT_RULES.map((rule) => [rule, {}])),
        ...YAMLLINT_RULE_OPTIONS,
    };
    for (const [rule, chosen] of Object.entries(getTable(context.selection.view, 'tools.yamllint').rules))
        rules[rule] = { ...(rules[rule] as Record<string, unknown>), ...chosen };
    Object.assign(
        rules,
        Object.fromEntries(listIgnoredRules(context.selection, 'files/yamllint').map((name) => [name, 'disable'])),
    );
    const document = { rules };
    return stringify(document, YAMLLINT_YAML_OPTIONS);
}

export { buildYamllintFile };
