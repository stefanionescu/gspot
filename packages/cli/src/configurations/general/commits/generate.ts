import { COMMITLINT_ERROR_SEVERITY, COMMITLINT_PARSER_PRESET } from '#cli/config/configurations/general.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { assertRunningRuleOptions, listDisabledRules } from '#cli/configurations/rule-options.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildCommitlintFile(planned: PlannedConfig): string {
    const { scopes } = planned.session;

    const commits = getTable(planned.scope.settings, 'commits');
    const commitlint = getTable(planned.scope.settings, 'tools.commitlint');
    const types = commits.types;
    const named = commits.scopes;
    const allowed =
        named.length > 0 ? named : scopes.filter(({ path }) => path !== '').map(({ path }) => path.split('/').at(-1));
    const rules: Record<string, readonly unknown[]> = {
        'type-enum': [COMMITLINT_ERROR_SEVERITY, 'always', types],
        ...planned.configuration.commitlint.rules,
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
    assertRunningRuleOptions({
        configured: Object.keys(options),
        running,
        allLevelRules: new Set<string>(),
        level: planned.level,
    });
    for (const [name, value] of Object.entries(options)) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of listDisabledRules(planned)) rules[name] = [0];
    return JSON.stringify({ parserPreset: COMMITLINT_PARSER_PRESET, rules }, null, JSON_INDENT);
}

export const COMMITS_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'commits/commitlint.json': buildCommitlintFile,
};
