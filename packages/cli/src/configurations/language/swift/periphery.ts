import { stringify as stringifyYaml } from 'yaml';

import { PERIPHERY_RETAIN } from '#cli/config/configurations/swift.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';

export const PERIPHERY_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'swift/periphery.yml': (planned) => {
        const swift = getTable(planned.scope.settings, 'swift');
        return stringifyYaml({
            ...(swift.xcode_project !== undefined && { project: swift.xcode_project }),
            ...(swift.xcode_scheme !== undefined && { schemes: [swift.xcode_scheme] }),
            ...PERIPHERY_RETAIN,
        });
    },
};
