import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { SHELLCHECK_CHECKS, SHELLCHECK_OPTIONS, SHELLCHECK_ALL_LEVEL_ON } from '#cli/config/configurations/bash.ts';

/**
Build shellcheckrc: the ShellCheck source-path and excluded-rule settings.

@param planned the config file to build.
*/
export function buildShellcheckFile(planned: PlannedConfig): string {
    const isAll = planned.level === 'all';
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_ON : [])];
    const disable = listDisabledRules(planned);
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}
