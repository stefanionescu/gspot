import { stringify as stringifyYaml } from 'yaml';
import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { ANSIBLE_LINT_ALWAYS_OFF } from '#cli/config/generation/settings/builders/ansible-lint.ts';

/**
 * Build the Ansible Lint file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Ansible Lint exclusions as YAML.
 */
export function buildAnsibleLintFile(planned: PlannedToolFile): string {
    return stringifyYaml({
        skip_list: [
            ...new Set([...ANSIBLE_LINT_ALWAYS_OFF, ...listIgnoredRules(planned.selection, 'ansible/ansible-lint')]),
        ],
    });
}
