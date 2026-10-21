// Writes the Bun security scanner that gspot.toml names into bunfig.toml.
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { ManagedKeys } from '#cli/types/ownership.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { BUNFIG_FILE, SCANNER_KEY } from '#cli/config/generation/bun-scanner.ts';

/**
 * Set the scanner in the bunfig.toml of each scope that selects dependencies, installs with Bun, and names a scanner.
 *
 * @param session the repository inventory and its scopes.
 * @returns the bunfig.toml edits.
 */
export function buildBunScannerEdits(session: Session): ManagedKeys[] {
    return session.scopes.flatMap((selection) => {
        const scanner = getTable(selection.view, 'dependencies').bun_scanner;
        const usesBun = LOCKFILES.filter((entry) => entry.packageManager === 'bun').some(({ file }) =>
            session.repository.files.some(({ path }) => path === joinScope(selection.scope.path, file)),
        );
        if (scanner === undefined || !usesBun) return [];
        return [{ path: joinScope(selection.scope.path, BUNFIG_FILE), keys: [{ key: SCANNER_KEY, value: scanner }] }];
    });
}
