import { stringify } from 'yaml';

import { HADOLINT_FAILURE_THRESHOLD, TRIVY_SKIPPED_FOLDERS } from '#cli/config/configurations/infrastructure.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Build hadolint.yml: the Hadolint exclusions and trusted registry settings.

@param planned the config file to build.
*/
function buildHadolintFile(planned: PlannedConfig): string {
    const off = listDisabledRules(planned);
    const registries = getTable(planned.scope.settings, 'docker').allowed_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 && { ignored: off }),
        ...(registries.length > 0 && { trustedRegistries: registries }),
    };
    return stringify(document);
}

export const DOCKER_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'docker/trivy.yml': (planned) => {
        return stringify({
            timeout: `${String(planned.session.settings.tool_timeout_seconds)}s`,
            severity: getTable(planned.scope.settings, 'docker').severity,
            scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
        });
    },
    'docker/hadolint.yml': buildHadolintFile,
};
