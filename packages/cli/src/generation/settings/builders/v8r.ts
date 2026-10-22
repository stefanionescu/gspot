import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { V8R_NOTES, MISE_SCHEMA } from '#cli/config/generation/settings/builders/v8r.ts';

/**
 * Build v8r.yml: the v8r schema catalog, including the configured file selectors.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns the v8r schema catalog, including the configured file selectors.
 */
export function buildV8rFile(planned: PlannedToolFile): string {
    const schemas = getTable(planned.scope.settings, 'tools.v8r').schema.map(({ paths, url }) => ({
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
