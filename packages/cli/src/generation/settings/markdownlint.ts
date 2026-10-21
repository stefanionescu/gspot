import { JSON_INDENT } from '#cli/config/generation/files.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { MARKDOWNLINT_RULES } from '#cli/config/generation/settings.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';

/**
 * Build the markdownlint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Markdown lint rules with the chosen level, indentation, and your own rule options.
 */
function buildMarkdownlintFile(context: ToolFileContext): string {
    const { format } = context.selection.view.values;
    const level = context.level;

    const isAll = level === 'all';
    const document: Record<string, boolean | Record<string, unknown>> = {
        ...MARKDOWNLINT_RULES,
        MD007: { indent: format.indent_width },
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    for (const [rule, chosen] of Object.entries(getTable(context.selection.view, 'tools.markdownlint').rules))
        if (document[rule] !== false)
            document[rule] = { ...(typeof document[rule] === 'object' ? document[rule] : {}), ...chosen };
    Object.assign(
        document,
        Object.fromEntries(listIgnoredRules(context.selection, 'markdown/markdownlint').map((rule) => [rule, false])),
    );
    return JSON.stringify(document, null, JSON_INDENT);
}

export { buildMarkdownlintFile };
