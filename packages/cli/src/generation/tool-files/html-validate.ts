import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';

import {
    HTML_RULES,
    HTML_ALL_RULES,
    HTML_BUILT_OVERRIDES,
    HTML_VALIDATE_EXTENDS,
} from '#cli/config/generation/html.ts';

/**
 * Write the htmlValidate configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param root1 the output options.
 * @param root1.level the selected check level.
 * @param root1.targetPath the generated destination path.
 *
 * @returns the generated configuration text.
 */
export function buildHtmlValidateFile(
    { rulesOff }: Pick<ScopeView, 'rulesOff'>,
    { level, targetPath }: { level: Level; targetPath: string },
): string {
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
