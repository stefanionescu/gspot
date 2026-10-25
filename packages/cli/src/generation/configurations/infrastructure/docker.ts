import { stringify } from 'yaml';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    TRIVY_SKIPPED_FOLDERS,
    HADOLINT_RECOMMENDED_OFF,
    HADOLINT_FAILURE_THRESHOLD,
} from '#cli/config/generation/configurations/infrastructure/docker.ts';

/**
Build hadolint.yml: the Hadolint exclusions and trusted registry settings.

@param planned the config file with its scope, level, and target path.
@returns the Hadolint exclusions and trusted registry settings.
*/
export function buildHadolintFile(planned: PlannedConfigFile): string {
    const isAll = planned.level === 'all';
    const off = [...listIgnoredRules(planned.scope, 'docker/hadolint'), ...(isAll ? [] : HADOLINT_RECOMMENDED_OFF)];
    const registries = getTable(planned.scope.settings, 'tools.hadolint').trusted_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 && { ignored: off }),
        ...(registries.length > 0 && { trustedRegistries: registries }),
    };
    return stringify(document);
}

/**
Build trivy.yml: the tool timeout, the reported severities, and the folders Trivy skips.

@param planned the config file with its scope, level, and target path.
@returns the Trivy settings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The config-file builder calls it by its target path.
export function buildTrivyFile(planned: PlannedConfigFile): string {
    return stringify({
        timeout: `${String(planned.session.settings.tool_timeout_seconds)}s`,
        severity: getTable(planned.scope.settings, 'tools.trivy').severity,
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    });
}
