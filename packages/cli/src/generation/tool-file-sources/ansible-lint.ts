import { stringify } from 'yaml';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { ALWAYS_SKIPPED_TAGS } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Keep disabled Ansible rules in the scope's configuration.
 *
 * @param root0 the values for this generated file.
 * @param root0.rulesOff the disabled lint rule reader.
 *
 * @returns the generated configuration text.
 */
export function ansibleLintToolFile({ rulesOff }: Pick<ScopeView, 'rulesOff'>): string {
    return stringify({ skip_list: [...new Set([...ALWAYS_SKIPPED_TAGS, ...rulesOff('ansible/ansible-lint')])] });
}
