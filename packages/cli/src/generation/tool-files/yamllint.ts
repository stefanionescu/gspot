import { stringify } from 'yaml';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    YAMLLINT_RULES,
    YAMLLINT_YAML_OPTIONS,
    YAMLLINT_RULE_OPTIONS,
} from '#cli/config/generation/tool-file-sources.ts';
/**
 * Build yamllint file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the YAML lint rules with the configured indentation and disabled checks.
 */
function buildYamllintFile(context: ToolFileContext): string {
    const { settings, rulesOff } = context.selection.view;

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

export { buildYamllintFile };
