import { stringify as stringifyToml } from '@decimalturn/toml-patch';

import {
    BUNFIG_FILE,
    OSV_SCANNER_CHECK,
    OSV_SCANNER_NOTES,
    SCANNER_KEY,
} from '#cli/config/configurations/dependencies.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable, listIgnores } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import type { ManagedKeys } from '#cli/types/repository.ts';
import type { Session } from '#cli/types/tools.ts';

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

export function buildBunScannerEdits(session: Session): ManagedKeys[] {
    return session.scopes.flatMap((scope) => {
        const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
        const hasBunLockfile = LOCKFILES.filter((lockfile) => lockfile.packageManager === 'bun').some(({ file }) =>
            session.repository.files.some(({ path }) => path === joinScope(scope.path, file)),
        );
        return scanner === undefined || !hasBunLockfile
            ? []
            : { path: joinScope(scope.path, BUNFIG_FILE), keys: [{ key: SCANNER_KEY, value: scanner }] };
    });
}

export const DEPENDENCIES_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'dependencies/osv-scanner.toml': buildOsvScannerFile,
};
