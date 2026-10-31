import { stringify } from 'yaml';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    HADOLINT_CHECK,
    HADOLINT_DEFAULT_LEVEL_OFF,
    HADOLINT_FAILURE_THRESHOLD,
} from '#cli/config/generation/configurations/infrastructure.ts';

/**
Build hadolint.yml: the Hadolint exclusions and trusted registry settings.

@param planned the config file to build.
*/
export function buildHadolintFile(planned: PlannedConfig): string {
    const isAll = planned.level === 'all';
    const off = [...listIgnoredRules(planned.scope, HADOLINT_CHECK), ...(isAll ? [] : HADOLINT_DEFAULT_LEVEL_OFF)];
    const registries = getTable(planned.scope.settings, 'tools.hadolint').trusted_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 && { ignored: off }),
        ...(registries.length > 0 && { trustedRegistries: registries }),
    };
    return stringify(document);
}
