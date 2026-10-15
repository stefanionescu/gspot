import { stringify } from '@decimalturn/toml-patch';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the lychee configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.options the command options.
 *
 * @returns the generated configuration text.
 */
export function lycheeToolFile({ options }: Pick<ScopeView, 'options'>): string {
    const exclude = options('docs').allowed_urls;
    return stringify(exclude.length === 0 ? {} : { exclude }, TOOL_EMIT_FORMAT).trimEnd();
}
