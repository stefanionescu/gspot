import { JSON_INDENT } from '#cli/config/text.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';

import {
    HTML_RULES,
    HTML_VALIDATE_EXTENDS,
    HTML_DEFAULT_LEVEL_OFF,
    HTML_VALIDATE_OVERRIDES,
} from '#cli/config/generation/configurations/language/language.ts';

/**
Build html-validate.json: the HTML validation rules for source files or built site pages.

@param planned the config file to build.
*/
export function buildHtmlValidateFile(planned: PlannedConfig): string {
    const configuration = planned.configuration.name;
    const check = `${configuration}/html-validate`;
    const rules: Record<string, unknown> = { ...HTML_RULES, ...HTML_VALIDATE_OVERRIDES[configuration] };
    for (const rule of [
        ...(planned.level === 'all' ? [] : HTML_DEFAULT_LEVEL_OFF),
        ...listIgnoredRules(planned.scope, check),
    ])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT);
}
