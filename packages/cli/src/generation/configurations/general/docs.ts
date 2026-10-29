import { getTable } from '#cli/settings/scopes.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { SITE_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';

import {
    LYCHEE_NOTES,
    LYCHEE_ROOT_NOTE,
    LYCHEE_SITE_NOTE,
    LYCHEE_ROOT_LINKS,
    LYCHEE_MDX_EXPRESSION,
    LYCHEE_REPOSITORY_LINKS,
} from '#cli/config/generation/configurations/general/docs.ts';

/**
Build lychee.toml: a note on why the file exists, and the lychee link exclusions as TOML.

@param planned the config file to build.
*/
export function buildLycheeFile(planned: PlannedConfigFile): string {
    const { configurations, settings } = planned.scope;

    const exclude = [...getTable(settings, 'docs').allowed_urls, LYCHEE_MDX_EXPRESSION];
    const isSite = configurations.some((configuration) => configuration.name === SITE_CONFIGURATION);
    const document = isSite
        ? { exclude: [...exclude, LYCHEE_ROOT_LINKS] }
        : { exclude, remap: [`${LYCHEE_ROOT_LINKS} ${LYCHEE_REPOSITORY_LINKS}`] };
    return [
        ...LYCHEE_NOTES,
        isSite ? LYCHEE_SITE_NOTE : LYCHEE_ROOT_NOTE,
        stringifyToml(document, CONFIG_FILE_TOML_FORMAT),
    ].join('\n');
}
