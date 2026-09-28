import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { ConfigurationOutput } from '#cli/types/generation.ts';
import { SECONDS_PER_DAY, DEFAULT_RELEASE_AGE_DAYS } from '#cli/constants/generation.ts';

/**
 * Manage Bun installation safeguards while preserving unrelated authored fields.
 * @param root the repository root
 * @param scopes every resolved scope
 * @returns the shared configuration keys to install in each Bun configuration file
 */
export function bunConfiguration(root: string, scopes: ScopeSelection[]): ConfigurationOutput[] {
    const files = openConfinedRoot(root);
    try {
        const selected = scopes
            .filter((selection) =>
                selection.selected.some((manifest) => manifest.configuration.name === 'dependencies'),
            )
            .map((selection) => ({ selection, prefix: selection.scope.path === '' ? '' : `${selection.scope.path}/` }))
            .filter(({ prefix }) =>
                ['bun.lock', 'bun.lockb'].some((name) => files.stat(`${prefix}${name}`) !== undefined),
            );
        return selected.map(({ selection, prefix }) => {
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
            return { path, format: 'toml' as const, changes };
        });
    } finally {
        files.close();
    }
}
