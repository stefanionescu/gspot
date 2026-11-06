import { stringify as stringifyToml } from '@decimalturn/toml-patch';

import {
    LYCHEE_MDX_EXPRESSION,
    LYCHEE_NOTES,
    LYCHEE_REPOSITORY_LINKS,
    LYCHEE_ROOT_LINKS,
    LYCHEE_ROOT_NOTE,
    LYCHEE_SITE_NOTE,
    SITE_CONFIGURATION,
} from '#cli/config/configurations/general.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

function buildLycheeFile(planned: PlannedConfig): string {
    const { configurations, settings } = planned.scope;

    const exclude = [...getTable(settings, 'docs').allowed_urls, LYCHEE_MDX_EXPRESSION];
    const isSite = configurations.some((configuration) => configuration.name === SITE_CONFIGURATION);
    const document = isSite
        ? { exclude: [...exclude, LYCHEE_ROOT_LINKS] }
        : { exclude, remap: [`${LYCHEE_ROOT_LINKS} ${LYCHEE_REPOSITORY_LINKS}`] };
    return [
        ...LYCHEE_NOTES,
        isSite ? LYCHEE_SITE_NOTE : LYCHEE_ROOT_NOTE,
        stringifyToml(document, CONFIG_TOML_FORMAT),
    ].join('\n');
}

export const DOCS_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'docs/lychee.toml': buildLycheeFile,
};
