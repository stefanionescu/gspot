import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import { refuseIdleRuleOptions } from '#cli/generation/rule-options.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { COMMITLINT_CHECK } from '#cli/config/checks/general/general.ts';

import {
    COMMITLINT_RULES,
    COMMITLINT_PARSER_PRESET,
    COMMITLINT_ERROR_SEVERITY,
} from '#cli/config/generation/configurations/general.ts';

/**
Build commitlint.json: the Commitlint rules with the allowed types and scopes of the repository.

@param planned the config file to build.
*/
export function buildCommitlintFile(planned: PlannedConfigFile): string {
    const { scopes } = planned.session;

    const commitlint = getTable(planned.scope.settings, 'tools.commitlint');
    const types = commitlint.types;
    const named = commitlint.scopes;
    const allowed =
        named.length > 0 ? named : scopes.filter(({ path }) => path !== '').map(({ path }) => path.split('/').at(-1));
    const rules: Record<string, readonly unknown[]> = {
        'type-enum': [COMMITLINT_ERROR_SEVERITY, 'always', types],
        ...COMMITLINT_RULES,
    };
    if (allowed.length > 0) {
        rules['scope-enum'] = [COMMITLINT_ERROR_SEVERITY, 'always', allowed];
        rules['scope-case'] = [0];
    }
    const options = commitlint.rules;
    const running = new Set(
        Object.entries(rules)
            .filter(([, value]) => value[0] !== 0)
            .map(([name]) => name),
    );
    refuseIdleRuleOptions({
        configured: Object.keys(options),
        running,
        allLevelRules: new Set<string>(),
        level: planned.level,
    });
    for (const [name, value] of Object.entries(options)) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of listIgnoredRules(planned.scope, COMMITLINT_CHECK)) rules[name] = [0];
    return JSON.stringify({ parserPreset: COMMITLINT_PARSER_PRESET, rules }, null, JSON_INDENT);
}
