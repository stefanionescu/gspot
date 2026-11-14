import { getTable } from '#cli/settings/tables.ts';
import { JSON_INDENT } from '#cli/config/tools/programs.ts';
import type { ConfigBuilder } from '#cli/types/configurations/shared.ts';
import { buildHtmlValidateFile } from '#cli/configurations/language/html/generate.ts';

export const SITE_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'site/purgecss-safelist.json': (planned) =>
        JSON.stringify(getTable(planned.scope.settings, 'site').allowed_classes, null, JSON_INDENT),
    'site/html-validate.json': buildHtmlValidateFile,
};
