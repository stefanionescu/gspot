import { stringify } from 'yaml';

import { SCHEMA_CHECK_NOTES } from '#cli/config/configurations/language.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildV8rFile(planned: PlannedConfig): string {
    const schemas = getTable(planned.scope.settings, 'json').schemas.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return [
        ...SCHEMA_CHECK_NOTES,
        stringify({
            ignoreErrors: true,
            ...(schemas.length > 0 && { customCatalog: { schemas } }),
        }),
    ].join('\n');
}

export const JSON_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'json/v8r.yml': buildV8rFile,
};
