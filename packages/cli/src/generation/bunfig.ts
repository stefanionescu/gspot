import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readText } from '#cli/system/files/reads.ts';
import { SECONDS_PER_DAY } from '#cli/config/units.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';

import {
    BUNFIG_FILE,
    SCANNER_KEY,
    RELEASE_AGE_KEY,
    SCANNER_SETTING,
    RELEASE_AGE_SETTING,
    DEPENDENCIES_CONFIGURATION,
} from '#cli/config/generation/file-edits.ts';

/**
 * The `[install]` keys gspot sets in each bunfig.toml beside a Bun lockfile, in scopes that select dependencies.
 *
 * @param root the repository root.
 * @param scopes every resolved scope.
 *
 * @returns each file path and its installation key changes.
 */
export function buildBunfigEdits(root: string, scopes: ScopeSelection[]): FileEdit[] {
    using files = openFiles(root);
    const selected = scopes
        .filter((selection) =>
            selection.selected.some((manifest) => manifest.configuration.name === DEPENDENCIES_CONFIGURATION),
        )
        .map((selection) => ({ selection, prefix: joinScope(selection.scope.path, '') }))
        .filter(({ prefix }) =>
            LOCKFILES.filter((entry) => entry.client === 'bun').some(
                ({ file: name }) => files.stat(`${prefix}${name}`) !== undefined,
            ),
        );
    return selected.map(({ selection, prefix }) => {
        const path = `${prefix}${BUNFIG_FILE}`;
        const source = readText(root, path);
        const document = source === undefined ? {} : parseTomlFile({ path, source });
        const install = document['install'] as Record<string, unknown> | undefined;
        const { settings } = selection.view;
        const required = Number(settings[RELEASE_AGE_SETTING]) * SECONDS_PER_DAY;
        const current = install?.['minimumReleaseAge'];
        const changes: FileEdit['changes'] = [
            {
                path: RELEASE_AGE_KEY,
                value: typeof current === 'number' ? Math.max(required, current) : required,
            },
        ];
        const scanner = settings[SCANNER_SETTING];
        if (typeof scanner === 'string') changes.push({ path: SCANNER_KEY, value: scanner });
        return { path, changes };
    });
}
