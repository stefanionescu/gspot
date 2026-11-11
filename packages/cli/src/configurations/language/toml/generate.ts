import { stringify } from '@decimalturn/toml-patch';

import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';

const TAPLO_FORMATTING = {
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

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
