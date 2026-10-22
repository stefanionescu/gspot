import { stringify } from 'yaml';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    HADOLINT_RECOMMENDED_OFF,
    HADOLINT_FAILURE_THRESHOLD,
} from '#cli/config/generation/configurations/infrastructure/docker.ts';

/**
 * Build hadolint.yml: the Hadolint exclusions and trusted registry settings.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Hadolint exclusions and trusted registry settings.
 */
export function buildHadolintFile(planned: PlannedConfigFile): string {
    const level = planned.level;

    const isAll = level === 'all';
    const off = [...listIgnoredRules(planned.scope, 'docker/hadolint'), ...(isAll ? [] : HADOLINT_RECOMMENDED_OFF)];
    const registries = getTable(planned.scope.settings, 'tools.hadolint').trusted_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 ? { ignored: off } : {}),
        ...(registries.length > 0 ? { trustedRegistries: registries } : {}),
    };
    return stringify(document);
}
