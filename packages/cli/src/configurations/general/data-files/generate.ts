import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { V8R_NOTES, TAPLO_FORMATTING } from '#cli/config/configurations/general.ts';

/**
Build v8r.yml: the v8r schema catalog, including the configured file selectors.

@param planned the config file to build.
*/
function buildV8rFile(planned: PlannedConfig): string {
    const schemas = getTable(planned.scope.settings, 'data_files').schemas.map(({ paths, url }) => ({
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

export const DATA_FILES_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'data-files/taplo.toml': (planned) => {
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
    },
    'data-files/v8r.yml': buildV8rFile,
};
