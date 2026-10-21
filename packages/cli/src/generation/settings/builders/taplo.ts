import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { TOOL_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';
import { TAPLO_FORMATTING } from '#cli/config/generation/settings/builders/taplo.ts';

/**
 * Build the Taplo file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Taplo formatting settings with automatic schema lookup disabled.
 */
export function buildTaploFile(planned: PlannedToolFile): string {
    const { format } = planned.selection.view.values;

    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
            },
        },
        TOOL_FILE_TOML_FORMAT,
    );
}
