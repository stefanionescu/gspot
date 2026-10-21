import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_ALL_RULES,
    HTML_VALIDATE_EXTENDS,
    HTML_VALIDATE_OVERRIDES,
} from '#cli/config/generation/html.ts';

/**
 * Build HTML validation settings for source files or built site pages.
 *
 * @param context the settings file to build.
 * @returns the rules for the configuration's HTML validation check.
 */
export function buildHtmlSettings(context: ToolFileContext): string {
    const configuration = context.manifest.configuration.name;
    const check = `${configuration}/html-validate`;
    const rules: Record<string, unknown> = { ...HTML_RULES, ...HTML_VALIDATE_OVERRIDES[configuration] };
    for (const rule of [
        ...(context.level === 'all' ? [] : HTML_ALL_RULES),
        ...listIgnoredRules(context.selection, check),
    ])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT);
}
