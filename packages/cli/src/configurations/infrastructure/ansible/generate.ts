import { stringify } from 'yaml';
import { listOffRules } from '#cli/configurations/rule-options.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build the Ansible exclusions from configured rule ignores.

@param planned the config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects this configuration's generator through its shared builder interface.
export function buildAnsibleLintFile(planned: PlannedConfig): string {
    return stringify({ skip_list: listOffRules(planned) });
}
