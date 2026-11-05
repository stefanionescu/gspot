import { stringify } from 'yaml';

import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';

export const ANSIBLE_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'ansible/ansible-lint.yml': (planned) => stringify({ skip_list: listDisabledRules(planned) }),
};
