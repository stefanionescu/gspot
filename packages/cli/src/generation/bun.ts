// Writes the Bun security scanner that gspot.toml names into bunfig.toml.
import { joinScope } from '#cli/repository/scopes.ts';
import type { Session } from '#cli/types/planning.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { FileSettings } from '#cli/types/ownership.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { BUNFIG_FILE, SCANNER_KEY } from '#cli/config/generation/file-edits.ts';

/**
 * Set the scanner in the bunfig.toml of each scope that selects dependencies, installs with Bun, and names a scanner.
 *
 * @param session the repository inventory and its scopes.
 * @returns the bunfig.toml edits.
 */
export function buildBunScannerEdits(session: Session): FileSettings[] {
    return session.scopes.flatMap((selection) => {
        const scanner = getTable(selection.view, 'dependencies').bun_scanner;
        const usesBun = LOCKFILES.filter((entry) => entry.packageManager === 'bun').some(({ file }) =>
            session.repository.files.some(({ path }) => path === joinScope(selection.scope.path, file)),
        );
        if (scanner === undefined || !usesBun) return [];
        return [
            { path: joinScope(selection.scope.path, BUNFIG_FILE), changes: [{ path: SCANNER_KEY, value: scanner }] },
        ];
    });
}
