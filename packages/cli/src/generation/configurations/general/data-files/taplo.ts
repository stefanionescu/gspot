import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import { TAPLO_FORMATTING } from '#cli/config/generation/configurations/general/data-files/taplo.ts';

/**
 * Build taplo.toml: the Taplo formatting settings with automatic schema lookup disabled.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Taplo formatting settings with automatic schema lookup disabled.
 */
export function buildTaploFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.values;

    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
            },
        },
        CONFIG_FILE_TOML_FORMAT,
    );
}
