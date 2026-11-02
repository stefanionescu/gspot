import { stringify } from 'yaml';
import { getTable } from '#cli/settings/scopes.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { TRIVY_SKIPPED_FOLDERS, HADOLINT_FAILURE_THRESHOLD } from '#cli/config/configurations/infrastructure.ts';

/**
Build hadolint.yml: the Hadolint exclusions and trusted registry settings.

@param planned the config file to build.
*/
export function buildHadolintFile(planned: PlannedConfig): string {
    const off = listDisabledRules(planned);
    const registries = getTable(planned.scope.settings, 'docker').allowed_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 && { ignored: off }),
        ...(registries.length > 0 && { trustedRegistries: registries }),
    };
    return stringify(document);
}

/**
Build the Trivy timeout, severity, and skipped folders.

@param planned the config file and scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIG_BUILDERS selects this configuration's generator through its shared builder interface.
export function buildTrivyFile(planned: PlannedConfig): string {
    return stringify({
        timeout: `${String(planned.session.settings.tool_timeout_seconds)}s`,
        severity: getTable(planned.scope.settings, 'docker').severity,
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    });
}
