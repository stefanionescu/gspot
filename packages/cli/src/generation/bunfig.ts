import { readText } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { SECONDS_PER_DAY } from '#cli/config/platform/runtime.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { EmittedToolFile } from '#cli/types/generation/files.ts';

/**
 * The `[install]` keys gspot sets in each bunfig.toml beside a Bun lockfile, in scopes that select dependencies.
 * @param root the repository root
 * @param scopes every resolved scope
 * @returns each file path and its installation key changes
 */
export function bunfigChanges(root: string, scopes: ScopeSelection[]): EmittedToolFile[] {
    using files = openRoot(root);
    const selected = scopes
        .filter((selection) => selection.selected.some((manifest) => manifest.configuration.name === 'dependencies'))
        .map((selection) => ({ selection, prefix: selection.scope.path === '' ? '' : `${selection.scope.path}/` }))
        .filter(({ prefix }) => ['bun.lock', 'bun.lockb'].some((name) => files.stat(`${prefix}${name}`) !== undefined));
    return selected.map(({ selection, prefix }) => {
        const path = `${prefix}bunfig.toml`;
        const source = readText(root, path);
        const document = source === undefined ? {} : parseTomlFile({ path, source });
        const install = document['install'] as Record<string, unknown> | undefined;
        const { settings } = selection.view;
        const required = Number(settings['dependencies.min_release_age_days']) * SECONDS_PER_DAY;
        const current = install?.['minimumReleaseAge'];
        const changes: EmittedToolFile['changes'] = [
            {
                path: ['install', 'minimumReleaseAge'],
                value: typeof current === 'number' ? Math.max(required, current) : required,
            },
        ];
        const scanner = settings['dependencies.scanner'];
        if (typeof scanner === 'string' && scanner !== '')
            changes.push({ path: ['install', 'security', 'scanner'], value: scanner });
        return { path, changes };
    });
}
