import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    SHELLCHECK_CHECKS,
    SHELLCHECK_OPTIONS,
    SHELLCHECK_ALL_LEVEL_ON,
} from '#cli/config/generation/configurations/language/bash.ts';

/**
 * Build shellcheckrc: the ShellCheck source-path and excluded-rule settings.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the ShellCheck source-path and excluded-rule settings.
 */
export function buildShellcheckFile(planned: PlannedConfigFile): string {
    const level = planned.level;

    const isAll = level === 'all';
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_ON : [])];
    const disable = listIgnoredRules(planned.scope, 'bash/shellcheck');
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}
