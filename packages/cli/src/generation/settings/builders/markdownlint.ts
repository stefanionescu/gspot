import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';
import { MARKDOWNLINT_RULES } from '#cli/config/generation/settings/builders/markdownlint.ts';

/**
 * Build the markdownlint file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Markdown lint rules with the chosen level, indentation, and your own rule options.
 */
export function buildMarkdownlintFile(planned: PlannedToolFile): string {
    const { format } = planned.scope.settings.values;
    const level = planned.level;

    const isAll = level === 'all';
    const document: Record<string, boolean | Record<string, unknown>> = {
        ...MARKDOWNLINT_RULES,
        MD007: { indent: format.indent_width },
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    for (const [rule, chosen] of Object.entries(getTable(planned.scope.settings, 'tools.markdownlint').rules))
        if (document[rule] !== false)
            document[rule] = { ...(typeof document[rule] === 'object' ? document[rule] : {}), ...chosen };
    Object.assign(
        document,
        Object.fromEntries(listIgnoredRules(planned.scope, 'markdown/markdownlint').map((rule) => [rule, false])),
    );
    return JSON.stringify(document, null, JSON_INDENT);
}
