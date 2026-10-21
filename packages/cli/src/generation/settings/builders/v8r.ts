import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { MISE_SCHEMA } from '#cli/config/generation/settings/builders/v8r.ts';

/**
 * Build the v8r file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the v8r schema catalog, including the configured file selectors.
 */
export function buildV8rFile(planned: PlannedToolFile): string {
    const schemas = getTable(planned.scope.settings, 'tools.v8r').schema.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return (
        '# Files without a known schema are checked by their other selected tools.\n' +
        stringifyYaml({
            ignoreErrors: true,
            customCatalog: { schemas: [MISE_SCHEMA, ...schemas] },
        })
    );
}
