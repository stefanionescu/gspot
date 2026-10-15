import { stringify } from 'yaml';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { MISE_SCHEMA } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the v8r configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function v8rToolFile({ settings }: Pick<ScopeView, 'settings'>): string {
    const schemas = (settings['tools.v8r.schema'] as { paths: string[]; url: string }[]).map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return (
        '# Files without a known schema are checked by their other selected tools.\n' +
        stringify({ ignoreErrors: true, customCatalog: { schemas: [MISE_SCHEMA, ...schemas] } }).trimEnd()
    );
}
