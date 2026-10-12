import { stringify } from '@decimalturn/toml-patch';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { TOOL_EMIT_FORMAT, TAPLO_FORMATTING } from '#cli/config/generation/tool-file-sources.ts';
/**
 * Write the taplo configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.format the resolved formatting settings.
 * @param root0.extra the authored additional tool options.
 *
 * @returns the generated configuration text.
 */
export function taploToolFile({ format, extra }: Pick<ScopeView, 'format' | 'extra'>): string {
    return stringify(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
                ...extra('taplo'),
            },
        },
        TOOL_EMIT_FORMAT,
    ).trimEnd();
}
