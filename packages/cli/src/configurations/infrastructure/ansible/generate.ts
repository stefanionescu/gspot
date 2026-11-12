import { stringify } from 'yaml';

import { LEVEL_PROFILES } from '#cli/config/configurations/infrastructure.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/shared.ts';

export const ANSIBLE_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'ansible/ansible-lint.yml': (planned) =>
        stringify({ profile: LEVEL_PROFILES[planned.level], skip_list: listDisabledRules(planned) }),
};
