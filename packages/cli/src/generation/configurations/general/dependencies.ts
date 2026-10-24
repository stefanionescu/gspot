import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import { getTable, listIgnores } from '#cli/settings/scopes.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';

import {
    SCANNER_KEY,
    BUNFIG_FILE,
    OSV_SCANNER_NOTES,
} from '#cli/config/generation/configurations/general/dependencies.ts';

/**
Build osv-scanner.toml: a note on why the file exists, and the package ignores, reasons, and expiration dates.

@param planned the config file with its scope, level, and target path.
@returns a note on why the file exists, and the package ignores, reasons, and expiration dates.
*/
export function buildOsvScannerFile(planned: PlannedConfigFile): string {
    const ignores = listIgnores(planned.scope.settings, 'dependencies/osv-scanner').filter(
        (ignore) => ignore.rule !== undefined && ignore.paths.length === 0,
    );
    const vulnerabilities = ignores.map((ignore) => ({
        id: ignore.rule,
        ...(ignore.until ? { ignoreUntil: ignore.until } : {}),
        reason: ignore.reason,
    }));
    return [
        ...OSV_SCANNER_NOTES,
        stringifyToml(ignores.length === 0 ? {} : { IgnoredVulns: vulnerabilities }, CONFIG_FILE_TOML_FORMAT),
    ].join('\n');
}

/**
Set the scanner in the bunfig.toml of each scope that selects dependencies, installs with Bun, and names a scanner.

@param session the repository inventory and its scopes.
@returns the bunfig.toml edits.
*/
export function buildBunScannerEdits(session: Session): ManagedKeys[] {
    return session.scopes.flatMap((scope) => {
        const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
        const usesBun = LOCKFILES.filter((lockfile) => lockfile.packageManager === 'bun').some(({ file }) =>
            session.repository.files.some(({ path }) => path === joinScope(scope.folder.path, file)),
        );
        if (scanner === undefined || !usesBun) return [];
        return [{ path: joinScope(scope.folder.path, BUNFIG_FILE), keys: [{ key: SCANNER_KEY, value: scanner }] }];
    });
}
