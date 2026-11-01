import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { V8R_TABLE, V8R_NOTES, TAPLO_FORMATTING } from '#cli/config/configurations/general.ts';

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
            ...(schemas.length > 0 && { customCatalog: { schemas } }),
        }),
    ].join('\n');
}

/**
Build the Taplo formatter settings with the selected indentation.

@param planned the config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects this configuration's generator through its shared builder interface.
export function buildTaploFile(planned: PlannedConfig): string {
    const { format } = planned.scope.settings.tables;
    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                ...TAPLO_FORMATTING,
            },
        },
        CONFIG_TOML_FORMAT,
    );
}
