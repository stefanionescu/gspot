import { getTable } from '#cli/settings/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { listOffRules, refuseIdleRuleOptions } from '#cli/configurations/rule-options.ts';

import {
    PRETTIER_STYLE,
    MARKDOWNLINT_RULES,
    MARKDOWNLINT_ALL_RULES,
    MARKDOWNLINT_PRETTIER_DISABLED,
} from '#cli/config/configurations/language.ts';

/**
Build markdownlint.jsonc: the Markdown lint rules for the level, indentation, and your own rule options.

@param planned the config file to build.
*/
export function buildMarkdownlintFile(planned: PlannedConfig): string {
    const isAll = planned.level === 'all';
    const document: Record<string, string | boolean | Record<string, unknown>> = {
        extends: PRETTIER_STYLE,
        ...MARKDOWNLINT_RULES,
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    const options = getTable(planned.scope.settings, 'tools.markdownlint').rules;
    const running = new Set(
        Object.keys(options).filter(
            (rule) => document[rule] !== false && !(MARKDOWNLINT_PRETTIER_DISABLED as readonly string[]).includes(rule),
        ),
    );
    refuseIdleRuleOptions({
        configured: Object.keys(options),
        running,
        allLevelRules: new Set(MARKDOWNLINT_ALL_RULES),
        level: planned.level,
    });
    for (const [rule, ruleOptions] of Object.entries(options))
        document[rule] = { ...(typeof document[rule] === 'object' && document[rule]), ...ruleOptions };
    Object.assign(document, Object.fromEntries(listOffRules(planned).map((rule) => [rule, false])));
    return JSON.stringify(document, null, JSON_INDENT);
}
