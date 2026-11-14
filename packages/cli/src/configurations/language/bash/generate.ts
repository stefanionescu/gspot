import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';
import { SHELLCHECK_OPTIONS, SHELLCHECK_ALL_LEVEL_ON } from '#cli/config/configurations/bash.ts';

function buildShellcheckFile(planned: PlannedConfig): string {
    const disable = listDisabledRules(planned);
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        ...(planned.level === 'all' ? [`enable=${SHELLCHECK_ALL_LEVEL_ON.join(',')}`] : []),
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}

export const BASH_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'bash/shellcheckrc': buildShellcheckFile,
};
