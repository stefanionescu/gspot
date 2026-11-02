import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { listOffRules } from '#cli/configurations/rule-options.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

import {
    HTML_VALIDATE_RULES,
    HTML_VALIDATE_EXTENDS,
    HTML_VALIDATE_OVERRIDES,
} from '#cli/config/configurations/language.ts';

/**
Build html-validate.json: the HTML validation rules for source files or built site pages.

@param planned the config file to build.
*/
export function buildHtmlValidateFile(planned: PlannedConfig): string {
    const configuration = planned.configuration.name;
    const rules: Record<string, unknown> = {
        ...(configuration === 'html' && HTML_VALIDATE_RULES),
        ...HTML_VALIDATE_OVERRIDES[configuration],
    };
    for (const rule of listOffRules(planned)) rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT);
}
