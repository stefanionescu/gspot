import { parse as parseToml } from 'smol-toml';
import { readText } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { SECONDS_PER_DAY } from '#cli/config/generation/bunfig.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { ConfigurationOutput } from '#cli/types/generation/output.ts';

/**
 * Manage Bun installation safeguards while preserving unrelated authored fields.
 * @param root the repository root
 * @param scopes every resolved scope
 * @returns the shared configuration keys to install in each Bun configuration file
 */
export function bunConfiguration(root: string, scopes: ScopeSelection[]): ConfigurationOutput[] {
    using files = openRoot(root);
    const selected = scopes
        .filter((selection) => selection.selected.some((manifest) => manifest.configuration.name === 'dependencies'))
        .map((selection) => ({ selection, prefix: selection.scope.path === '' ? '' : `${selection.scope.path}/` }))
        .filter(({ prefix }) => ['bun.lock', 'bun.lockb'].some((name) => files.stat(`${prefix}${name}`) !== undefined));
    return selected.map(({ selection, prefix }) => {
        const path = `${prefix}bunfig.toml`;
        const source = readText(root, path);
        const document = source === undefined ? {} : parseToml(source);
        const install = document['install'] as Record<string, unknown> | undefined;
        const { settings } = selection.view;
        const required = Number(settings['dependencies.min_release_age_days']) * SECONDS_PER_DAY;
        const current = install?.['minimumReleaseAge'];
        const changes: ConfigurationOutput['changes'] = [
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
