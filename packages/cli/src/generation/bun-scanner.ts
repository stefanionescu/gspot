// Writes the Bun security scanner that gspot.toml names into bunfig.toml.
import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';

import {
    BUNFIG_FILE,
    SCANNER_KEY,
    BUN_LOCKFILES,
    SCANNER_SETTING,
    DEPENDENCIES_CONFIGURATION,
} from '#cli/config/generation/file-edits.ts';

/**
 * Set the scanner in the bunfig.toml of each scope that selects dependencies, installs with Bun, and names a scanner.
 *
 * @param repositoryRoot where the scopes sit.
 * @param scopes every scope.
 * @returns the bunfig.toml edits.
 */
export function buildBunScannerEdits(repositoryRoot: string, scopes: ScopeSelection[]): FileEdit[] {
    using files = openFiles(repositoryRoot);
    return scopes.flatMap((selection) => {
        const scanner = selection.view.settings[SCANNER_SETTING];
        const prefix = joinScope(selection.scope.path, '');
        const usesBun = BUN_LOCKFILES.some((name) => files.read(`${prefix}${name}`) !== undefined);
        const isSelected = selection.selected.some(
            (manifest) => manifest.configuration.name === DEPENDENCIES_CONFIGURATION,
        );
        if (typeof scanner !== 'string' || !usesBun || !isSelected) return [];
        return [{ path: `${prefix}${BUNFIG_FILE}`, changes: [{ path: SCANNER_KEY, value: scanner }] }];
    });
}
