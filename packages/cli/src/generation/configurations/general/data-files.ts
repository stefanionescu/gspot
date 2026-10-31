import { stringify as stringifyYaml } from 'yaml';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    V8R_TABLE,
    V8R_NOTES,
    MISE_SCHEMA,
    YAMLLINT_CHECK,
    YAMLLINT_RULES,
    YAMLLINT_YAML_OPTIONS,
    YAMLLINT_RULE_OPTIONS,
} from '#cli/config/generation/configurations/general.ts';

/**
Build v8r.yml: the v8r schema catalog, including the configured file selectors.

@param planned the config file to build.
*/
export function buildV8rFile(planned: PlannedConfig): string {
    const schemas = getTable(planned.scope.settings, V8R_TABLE).schema.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return [
        ...V8R_NOTES,
        stringifyYaml({
            ignoreErrors: true,
            customCatalog: { schemas: [MISE_SCHEMA, ...schemas] },
        }),
    ].join('\n');
}

/**
Build yamllint.yml: the YAML lint rules with the configured indentation and disabled checks.

@param planned the config file to build.
*/
export function buildYamllintFile(planned: PlannedConfig): string {
    const rules: Record<string, unknown> = {
        ...Object.fromEntries(YAMLLINT_RULES.map((rule) => [rule, {}])),
        ...YAMLLINT_RULE_OPTIONS,
    };
    for (const [rule, ruleOptions] of Object.entries(getTable(planned.scope.settings, 'tools.yamllint').rules))
        rules[rule] = { ...(rules[rule] as Record<string, unknown>), ...ruleOptions };
    Object.assign(
        rules,
        Object.fromEntries(listIgnoredRules(planned.scope, YAMLLINT_CHECK).map((name) => [name, 'disable'])),
    );
    const document = { rules };
    return stringifyYaml(document, YAMLLINT_YAML_OPTIONS);
}
