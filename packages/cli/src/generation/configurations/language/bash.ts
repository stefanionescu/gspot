import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    SHELLCHECK_CHECK,
    SHELLCHECK_CHECKS,
    SHELLCHECK_OPTIONS,
    SHELLCHECK_ALL_LEVEL_ON,
} from '#cli/config/generation/configurations/language/bash.ts';

/**
Build shellcheckrc: the ShellCheck source-path and excluded-rule settings.

@param planned the config file to build.
*/
export function buildShellcheckFile(planned: PlannedConfigFile): string {
    const isAll = planned.level === 'all';
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_ON : [])];
    const disable = listIgnoredRules(planned.scope, SHELLCHECK_CHECK);
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}
