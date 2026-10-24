import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { assertRuleOptionsRun } from '#cli/generation/config-files/rule-options.ts';
import { MARKDOWNLINT_RULES, MARKDOWNLINT_ALL_RULES } from '#cli/config/generation/configurations/language/markdown.ts';

/**
Build markdownlint.jsonc: the Markdown lint rules with the chosen level, indentation, and your own rule options.

@param planned the config file with its scope, level, and target path.
@returns the Markdown lint rules with the chosen level, indentation, and your own rule options.
*/
export function buildMarkdownlintFile(planned: Pick<PlannedConfigFile, 'scope' | 'level'>): string {
    const level = planned.level;

    const isAll = level === 'all';
    const document: Record<string, string | boolean | Record<string, unknown>> = {
        extends: 'markdownlint/style/prettier',
        ...MARKDOWNLINT_RULES,
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    const options = getTable(planned.scope.settings, 'tools.markdownlint').rules;
    const running = new Set(Object.keys(options).filter((rule) => document[rule] !== false));
    assertRuleOptionsRun({ chosen: Object.keys(options), running, higher: new Set(MARKDOWNLINT_ALL_RULES), level });
    for (const [rule, chosen] of Object.entries(options))
        document[rule] = { ...(typeof document[rule] === 'object' && document[rule]), ...chosen };
    Object.assign(
        document,
        Object.fromEntries(listIgnoredRules(planned.scope, 'markdown/markdownlint').map((rule) => [rule, false])),
    );
    return JSON.stringify(document, null, JSON_INDENT);
}
