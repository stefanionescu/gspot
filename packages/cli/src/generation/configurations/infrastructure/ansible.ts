import { stringify } from 'yaml';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { ANSIBLE_LINT_ALWAYS_OFF } from '#cli/config/generation/configurations/infrastructure/ansible.ts';

/**
Build ansible-lint.yml: the rules that ansible-lint always skips, and the rules that gspot.toml ignores.

@param planned the config file with its scope, level, and target path.
@returns the ansible-lint settings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildAnsibleLintFile(planned: PlannedConfigFile): string {
    const ignored = listIgnoredRules(planned.scope, 'ansible/ansible-lint');
    return stringify({ skip_list: [...new Set([...ANSIBLE_LINT_ALWAYS_OFF, ...ignored])] });
}
