import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    V8R_NOTES,
    MISE_SCHEMA,
    SETTINGS_SCHEMA,
} from '#cli/config/generation/configurations/general/data-files/v8r.ts';

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
