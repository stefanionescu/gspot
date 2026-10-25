import { stringify as stringifyYaml } from 'yaml';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';

import {
    V8R_NOTES,
    MISE_SCHEMA,
    YAMLLINT_RULES,
    SETTINGS_SCHEMA,
    TAPLO_FORMATTING,
    YAMLLINT_YAML_OPTIONS,
    YAMLLINT_RULE_OPTIONS,
} from '#cli/config/generation/configurations/general/data-files.ts';

/**
Build taplo.toml: the Taplo formatting settings with automatic schema lookup disabled.

@param planned the config file with its scope, level, and target path.
@returns the Taplo formatting settings with automatic schema lookup disabled.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildTaploFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.values;

    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
            },
        },
        CONFIG_FILE_TOML_FORMAT,
    );
}

/**
Build v8r.yml: the v8r schema catalog, including the configured file selectors.

@param planned the config file with its scope, level, and target path.
@returns the v8r schema catalog, including the configured file selectors.
*/
export function buildV8rFile(planned: PlannedConfigFile): string {
    const schemas = getTable(planned.scope.settings, 'tools.v8r').schema.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return [
        ...V8R_NOTES,
        stringifyYaml({
            ignoreErrors: true,
            customCatalog: { schemas: [MISE_SCHEMA, SETTINGS_SCHEMA, ...schemas] },
        }),
    ].join('\n');
}

/**
Build yamllint.yml: the YAML lint rules with the configured indentation and disabled checks.

@param planned the config file with its scope, level, and target path.
@returns the YAML lint rules with the configured indentation and disabled checks.
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
    return stringifyYaml(document, YAMLLINT_YAML_OPTIONS);
}
