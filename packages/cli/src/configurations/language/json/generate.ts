import { stringify } from 'yaml';

import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

const V8R_NOTES = ['# The other selected tools check files without a known schema.'];

function buildV8rFile(planned: PlannedConfig): string {
    const schemas = getTable(planned.scope.settings, 'json').schemas.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return [
        ...V8R_NOTES,
        stringify({
            ignoreErrors: true,
            ...(schemas.length > 0 && { customCatalog: { schemas } }),
        }),
    ].join('\n');
}

export const JSON_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'json/v8r.yml': buildV8rFile,
};
