// Pure calculations over validated configuration declarations. Registry reads stay with the manifest reader.
import { posix } from 'node:path';
import { CONFIG_PREFIX } from '#cli/config/configurations.ts';
import type { Manifest, OwnedCheck, ConfigurationFile } from '#cli/types/configurations.ts';

/**
 * Every declared check by ID, with the configuration that ships it. Borrowed checks retain their original owner.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
 */
export function allChecks(manifests: Iterable<Manifest>): Map<string, OwnedCheck> {
    const checks = new Map<string, OwnedCheck>();
    for (const manifest of manifests) {
        const owned = manifest.checks.filter((check) => !manifest.configuration.borrowed_checks.includes(check.name));
        for (const check of owned) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * The repository-relative path of a config file generated for a scope.
 * @param scope the scope path, empty for the root
 * @param config the config-file declaration
 * @returns the path of the generated config file
 */
export function targetInScope(scope: string, config: ConfigurationFile): string {
    if (scope === '' || !config.scoped) return config.target;
    if (config.target.startsWith(CONFIG_PREFIX))
        return posix.join(CONFIG_PREFIX, scope, config.target.slice(CONFIG_PREFIX.length));
    return `${scope}/${config.target}`;
}

/**
 * The name a `{config:<name>}` placeholder uses for a config file.
 * @param target the target path
 * @returns the file name under .gspot/config without its extensions
 */
export function configurationName(target: string): string {
    const bare = target.startsWith(CONFIG_PREFIX) ? target.slice(CONFIG_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/**
 * Exact npm package names declared by the supplied configurations.
 * @param manifests the configuration declarations
 * @returns installer package names for tooling-only package detection
 */
export function npmToolNames(manifests: Iterable<Manifest>): Set<string> {
    return new Set(
        [...manifests].flatMap((manifest) =>
            manifest.tools.flatMap((tool) => {
                const npm = tool.installers['npm'];
                return npm === undefined ? [] : [npm.name];
            }),
        ),
    );
}
