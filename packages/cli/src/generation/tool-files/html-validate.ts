import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_ALL_RULES,
    HTML_BUILT_OVERRIDES,
    HTML_VALIDATE_EXTENDS,
} from '#cli/config/generation/html.ts';

// The HTML Validate rules for the level, with the rules that the check's ignores turn off.
function writeHtmlValidateFile(context: ToolFileContext, check: string, overrides: Record<string, unknown>): string {
    const rules: Record<string, unknown> = { ...HTML_RULES, ...overrides };
    for (const rule of [...(context.level === 'all' ? [] : HTML_ALL_RULES), ...context.selection.view.rulesOff(check)])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT) + '\n';
}

/**
 * Write the HTML Validate rules for the HTML files in the repository.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the rules of html/html-validate.
 */
function buildSourceHtmlFile(context: ToolFileContext): string {
    return writeHtmlValidateFile(context, 'html/html-validate', {});
}

/**
 * Write the HTML Validate rules for the pages a site build writes, which allow the markup that build tools add.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the rules of site/html-validate.
 */
function buildBuiltHtmlFile(context: ToolFileContext): string {
    return writeHtmlValidateFile(context, 'site/html-validate', HTML_BUILT_OVERRIDES);
}

export { buildBuiltHtmlFile, buildSourceHtmlFile };
