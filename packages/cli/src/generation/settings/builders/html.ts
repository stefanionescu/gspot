import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_RECOMMENDED_OFF,
    HTML_VALIDATE_EXTENDS,
    HTML_VALIDATE_OVERRIDES,
} from '#cli/config/generation/settings/builders/html.ts';

/**
 * Build HTML validation settings for source files or built site pages.
 *
 * @param planned the settings file to build.
 * @returns the rules for the configuration's HTML validation check.
 */
export function buildHtmlSettings(planned: PlannedToolFile): string {
    const configuration = planned.configuration.name;
    const check = `${configuration}/html-validate`;
    const rules: Record<string, unknown> = { ...HTML_RULES, ...HTML_VALIDATE_OVERRIDES[configuration] };
    for (const rule of [
        ...(planned.level === 'all' ? [] : HTML_RECOMMENDED_OFF),
        ...listIgnoredRules(planned.selection, check),
    ])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT);
}
