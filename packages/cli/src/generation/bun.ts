import type { ScopeSelection } from '#cli/policy/resolve.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ConfigurationOutput } from '#cli/generation/proposal.ts';

/** The days a release must be public before Bun installs it when the policy names no age. */
export const DEFAULT_RELEASE_AGE_DAYS = 7;

/** The seconds in one day, for the age Bun reads. */
export const SECONDS_PER_DAY = 86_400;

/**
 * Manage Bun installation safeguards while preserving unrelated authored fields.
 * @param root the repository root
 * @param scopes every resolved scope
 * @returns the shared configuration keys to install in each Bun configuration file
 */
export function bunConfiguration(root: string, scopes: ScopeSelection[]): ConfigurationOutput[] {
    const files = openConfinedRoot(root);
    try {
        return scopes.flatMap((selection) => {
            if (!selection.selected.some((manifest) => manifest.configuration.name === 'dependencies')) return [];
            const prefix = selection.scope.path === '' ? '' : `${selection.scope.path}/`;
            if (!['bun.lock', 'bun.lockb'].some((name) => files.stat(`${prefix}${name}`) !== undefined)) return [];
            const path = `${prefix}bunfig.toml`;
            const source = files.read(path);
            const document =
                source === undefined ? {} : (Bun.TOML.parse(source.bytes.toString('utf8')) as Record<string, unknown>);
            const install = document['install'] as Record<string, unknown> | undefined;
            const settings = selection.view.tool('install');
            const required = Number(settings['min_release_age_days'] ?? DEFAULT_RELEASE_AGE_DAYS) * SECONDS_PER_DAY;
            const current = install?.['minimumReleaseAge'];
            const changes: ConfigurationOutput['changes'] = [
                {
                    path: ['install', 'minimumReleaseAge'],
                    value: typeof current === 'number' ? Math.max(required, current) : required,
                },
            ];
            const scanner = settings['security_scanner'];
            if (typeof scanner === 'string' && scanner !== '')
                changes.push({ path: ['install', 'security', 'scanner'], value: scanner });
            return [{ path, format: 'toml' as const, changes }];
        });
    } finally {
        files.close();
    }
}
