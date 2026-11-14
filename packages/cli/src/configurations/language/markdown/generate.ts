import { getTable } from '#cli/settings/tables.ts';
import { JSON_INDENT } from '#cli/config/tools/programs.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';
import { listDisabledRules, assertRunningRuleOptions } from '#cli/configurations/rule-options.ts';

import {
    PRETTIER_STYLE,
    MARKDOWNLINT_RULES,
    MARKDOWNLINT_ALL_RULES,
    MARKDOWNLINT_PRETTIER_DISABLED,
} from '#cli/config/configurations/markdown.ts';

function buildMarkdownlintFile(planned: PlannedConfig): string {
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
    assertRunningRuleOptions({
        configured: Object.keys(options),
        running,
        allLevelRules: new Set(MARKDOWNLINT_ALL_RULES),
        level: planned.level,
    });
    for (const [rule, ruleOptions] of Object.entries(options))
        document[rule] = { ...(typeof document[rule] === 'object' && document[rule]), ...ruleOptions };
    const configurationRules = planned.scope.configurations
        .flatMap(({ markdownlint }) => markdownlint.rules_off)
        .flatMap(({ rules }) => rules);
    for (const rule of [...listDisabledRules(planned), ...configurationRules]) document[rule] = false;
    return JSON.stringify(document, null, JSON_INDENT);
}

export const MARKDOWN_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
};
