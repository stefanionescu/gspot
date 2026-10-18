import { JSON_INDENT } from '#cli/config/generation/files.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_ALL_RULES,
    HTML_BUILT_OVERRIDES,
    HTML_VALIDATE_EXTENDS,
} from '#cli/config/generation/html.ts';

// Write the HTML Validate rules for the level, without the ones that the ignores of the check turn off.
function writeHtmlValidateFile(context: ToolFileContext, check: string, overrides: Record<string, unknown>): string {
    const rules: Record<string, unknown> = { ...HTML_RULES, ...overrides };
    for (const rule of [...(context.level === 'all' ? [] : HTML_ALL_RULES), ...context.selection.view.rulesOff(check)])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT) + '\n';
}

/**
 * Build the HTML Validate rules for the pages in the repository.
 * @param context the tool file to build.
 * @returns the rules of html/html-validate.
 */
function buildSourceHtmlFile(context: ToolFileContext): string {
    return writeHtmlValidateFile(context, 'html/html-validate', {});
}

/**
 * Build the HTML Validate rules for built site pages. They allow the markup that site generators add.
 * @param context the tool file to build.
 * @returns the rules of site/html-validate.
 */
function buildBuiltHtmlFile(context: ToolFileContext): string {
    return writeHtmlValidateFile(context, 'site/html-validate', HTML_BUILT_OVERRIDES);
}

export { buildBuiltHtmlFile, buildSourceHtmlFile };
