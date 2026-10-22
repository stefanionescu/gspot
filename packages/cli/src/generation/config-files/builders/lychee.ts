import { getTable } from '#cli/settings/scope-settings.ts';
import { SITE_CONFIGURATION } from '#cli/config/configurations.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';

import {
    LYCHEE_NOTES,
    LYCHEE_ROOT_LINKS,
    LYCHEE_MDX_EXPRESSION,
    LYCHEE_REPOSITORY_LINKS,
} from '#cli/config/generation/config-files/builders/lychee.ts';

/**
 * Build lychee.toml: a note on why the file exists, and the lychee link exclusions as TOML.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns a note on why the file exists, and the lychee link exclusions as TOML.
 */
export function buildLycheeFile(planned: PlannedConfigFile): string {
    const { configurations, settings } = planned.scope;

    const exclude = [...getTable(settings, 'docs').allowed_urls, LYCHEE_MDX_EXPRESSION];
    // site/lychee checks the routes in the built site, so lychee skips them.
    const document = configurations.some((configuration) => configuration.name === SITE_CONFIGURATION)
        ? { exclude: [...exclude, LYCHEE_ROOT_LINKS] }
        : { exclude, remap: [`${LYCHEE_ROOT_LINKS} ${LYCHEE_REPOSITORY_LINKS}`] };
    return [...LYCHEE_NOTES, stringifyToml(document, CONFIG_FILE_TOML_FORMAT)].join('\n');
}
