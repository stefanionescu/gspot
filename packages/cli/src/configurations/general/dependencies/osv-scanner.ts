import { stringify as stringifyToml } from '@decimalturn/toml-patch';

import { OSV_SCANNER_CHECK, OSV_SCANNER_NOTES } from '#cli/config/configurations/dependencies.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { listIgnores } from '#cli/settings/tables.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildOsvScannerFile(planned: PlannedConfig): string {
    const ignores = listIgnores(planned.scope.settings, OSV_SCANNER_CHECK).filter(
        (ignore) => ignore.rule !== undefined && ignore.paths === undefined,
    );
    const vulnerabilities = ignores.map((ignore) => ({
        id: ignore.rule,
        reason: ignore.reason,
    }));
    return [
        ...OSV_SCANNER_NOTES,
        stringifyToml(ignores.length === 0 ? {} : { IgnoredVulns: vulnerabilities }, CONFIG_TOML_FORMAT),
    ].join('\n');
}

export const DEPENDENCIES_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'dependencies/osv-scanner.toml': buildOsvScannerFile,
};
