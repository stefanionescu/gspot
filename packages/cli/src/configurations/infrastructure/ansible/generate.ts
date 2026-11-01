import { stringify } from 'yaml';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { ANSIBLE_LINT_CHECKS, ANSIBLE_LINT_ALWAYS_OFF } from '#cli/config/configurations/infrastructure.ts';

/**
Build the Ansible exclusions from configured rule ignores.

@param planned the config file and scope.
*/
export function buildAnsibleLintFile(planned: PlannedConfig): string {
    const ignored = ANSIBLE_LINT_CHECKS.flatMap((check) => listIgnoredRules(planned.scope, check));
    return stringify({ skip_list: [...new Set([...ANSIBLE_LINT_ALWAYS_OFF, ...ignored])] });
}
