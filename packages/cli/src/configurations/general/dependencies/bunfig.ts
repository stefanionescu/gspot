import { SCANNER_KEY } from '#cli/config/configurations/dependencies.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { BUNFIG_FILE } from '#cli/config/tools/installers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/tables.ts';
import { findValueAt } from '#cli/system/tables.ts';
import type { ManagedKeys } from '#cli/types/repository.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Files } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

// A scanner that the repository sets by itself in bunfig.toml is no change of this edit.
export function hasReleasedScanner(before: Scope, after: Scope, writer: Files): boolean {
    if (
        getTable(before.settings, 'dependencies').bun_scanner === undefined ||
        getTable(after.settings, 'dependencies').bun_scanner !== undefined
    )
        return false;
    const path = joinScope(after.path, BUNFIG_FILE);
    const bunfig = writer.read(path);
    return (
        bunfig !== undefined &&
        findValueAt(parseTomlFile(path, bunfig.bytes.toString('utf8')), SCANNER_KEY) !== undefined
    );
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
