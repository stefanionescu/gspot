import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';

export const NGINX_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'nginx/gixy.cfg': (planned) => {
        const off = listDisabledRules(planned);
        return off.length === 0 ? '' : `skips = ${off.join(',')}`;
    },
};
