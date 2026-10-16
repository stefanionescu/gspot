import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_ALL_RULES,
    HTML_BUILT_OVERRIDES,
    HTML_VALIDATE_EXTENDS,
} from '#cli/config/generation/html.ts';
/**
 * Build html validate file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the HTML Validate rules for the chosen level and template files.
 */
function buildHtmlValidateFile(context: ToolFileContext): string {
    const { rulesOff } = context.selection.view;
    const { level, targetPath } = context;

    const isAll = level === 'all';
    const isBuilt = targetPath.endsWith('html-validate-built.json');
    const rules: Record<string, unknown> = { ...HTML_RULES, ...(isBuilt ? HTML_BUILT_OVERRIDES : {}) };
    for (const rule of [
        ...(isAll ? [] : HTML_ALL_RULES),
        ...rulesOff(isBuilt ? 'site/html-validate' : 'html/validate'),
    ])
        rules[rule] = 'off';
    const document = {
        extends: HTML_VALIDATE_EXTENDS,
        rules,
    };
    return JSON.stringify(document, null, JSON_INDENT) + '\n';
}

export { buildHtmlValidateFile };
