import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

const SHELLCHECK_OPTIONS = [
    ['source-path', 'SCRIPTDIR'],
    ['external-sources', 'true'],
] as const;

const SHELLCHECK_ALL_LEVEL_ON = [
    'add-default-case',
    'avoid-negated-conditions',
    'avoid-nullary-conditions',
    'check-extra-masked-returns',
    'check-set-e-suppressed',
    'check-unassigned-uppercase',
    'deprecate-which',
    'quote-safe-variables',
    'require-double-brackets',
    'require-variable-braces',
    'useless-use-of-cat',
] as const;

/**
Build shellcheckrc: the ShellCheck source-path settings, the optional checks of level all, and the excluded rules.

@param planned the config file to build.
*/
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
