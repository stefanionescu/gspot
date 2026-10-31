import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { getTable, listIgnores } from '#cli/settings/scopes.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { ManagedKeys } from '#cli/types/repository/repository.ts';

import {
    SCANNER_KEY,
    BUNFIG_FILE,
    OSV_SCANNER_CHECK,
    OSV_SCANNER_NOTES,
} from '#cli/config/generation/configurations/general.ts';

/**
Build osv-scanner.toml: a note on why the file exists, and the package ignores and their reasons.

@param planned the config file to build.
*/
export function buildOsvScannerFile(planned: PlannedConfig): string {
    const ignores = listIgnores(planned.scope.settings, OSV_SCANNER_CHECK).filter(
        (ignore) => ignore.rule !== undefined && ignore.paths.length === 0,
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

/**
Set the scanner in the bunfig.toml of each scope that selects dependencies, installs with Bun, and names a scanner.

@param session the repository inventory and its scopes.
*/
export function buildBunScannerEdits(session: Session): ManagedKeys[] {
    return session.scopes.flatMap((scope) => {
        const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
        const usesBun = LOCKFILES.filter((lockfile) => lockfile.packageManager === 'bun').some(({ file }) =>
            session.repository.files.some(({ path }) => path === joinScope(scope.path, file)),
        );
        return scanner === undefined || !usesBun
            ? []
            : { path: joinScope(scope.path, BUNFIG_FILE), keys: [{ key: SCANNER_KEY, value: scanner }] };
    });
}
