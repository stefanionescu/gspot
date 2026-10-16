import type { ScopeView } from '#cli/types/settings/values.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { JSCPD_IGNORED } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the jscpd configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 * @param root0.ignoresFor the check path-ignore reader.
 *
 * @returns the generated configuration text.
 */
export function buildJscpdFile({ settings, ignoresFor }: Pick<ScopeView, 'settings' | 'ignoresFor'>): string {
    return JSON.stringify(
        {
            mode: 'strict',
            minLines: settings['limits.min_duplicate_lines'],
            minTokens: settings['limits.min_duplicate_tokens'],
            absolute: true,
            gitignore: true,
            ignore: [
                ...JSCPD_IGNORED,
                ...ignoresFor('duplication/jscpd')
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ],
        },
        null,
        JSON_INDENT,
    );
}
