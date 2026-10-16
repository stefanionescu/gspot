import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { MARKDOWNLINT_RULES } from '#cli/config/generation/tool-files.ts';
/**
 * Build markdownlint file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Markdown lint rules with the chosen level, indentation, and your own rule options.
 */
function buildMarkdownlintFile(context: ToolFileContext): string {
    const { format, settings, rulesOff } = context.selection.view;
    const level = context.level;

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

export { buildMarkdownlintFile };
