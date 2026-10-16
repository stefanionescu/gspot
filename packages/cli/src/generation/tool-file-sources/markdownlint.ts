import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { MARKDOWNLINT_RULES } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the markdownlint configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.format the resolved formatting settings.
 * @param root0.settings the validated settings.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param level the selected check level.
 *
 * @returns the generated configuration text.
 */
export function markdownlintToolFile(
    { format, settings, rulesOff }: Pick<ScopeView, 'format' | 'settings' | 'rulesOff'>,
    level: Level,
): string {
    const isAll = level === 'all';
    const document: Record<string, boolean | Record<string, unknown>> = {
        ...MARKDOWNLINT_RULES,
        MD007: { indent: format.indent_width },
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    for (const [rule, chosen] of Object.entries(
        settings['tools.markdownlint.rules'] as Record<string, Record<string, unknown>>,
    ))
        if (document[rule] !== false)
            document[rule] = { ...(typeof document[rule] === 'object' ? document[rule] : {}), ...chosen };
    Object.assign(document, Object.fromEntries(rulesOff('markdown/markdownlint').map((rule) => [rule, false])));
    return JSON.stringify(document, null, JSON_INDENT);
}
