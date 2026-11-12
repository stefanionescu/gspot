import { stringify } from '@decimalturn/toml-patch';

import { TAPLO_FORMATTING } from '#cli/config/configurations/language.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { ConfigBuilder } from '#cli/types/configurations/shared.ts';

export const TOML_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'toml/taplo.toml': (planned) => {
        const { format } = planned.scope.settings.tables;
        return stringify(
            {
                schema: { enabled: false },
                formatting: {
                    indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                    ...TAPLO_FORMATTING,
                },
            },
            CONFIG_TOML_FORMAT,
        );
    },
};
