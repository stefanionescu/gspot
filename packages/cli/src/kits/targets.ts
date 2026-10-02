import type { ConfigurationTarget } from '#cli/types/kits.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/kits.ts';

const GSPOT_DIRECTORY = `${CONFIGURATION_DIRECTORY}/`;

/**
 * The path of a configuration for a check in one scope: a target written for each scope lives under that scope.
 * @param scope the scope path, empty for the root
 * @param config the configuration target
 * @returns the repository-relative path
 */
export function targetInScope(scope: string, config: ConfigurationTarget): string {
    if (scope === '' || !config.per_scope) return config.target;
    if (config.target.startsWith(GSPOT_DIRECTORY)) return scopeFile(scope, config.target.slice(GSPOT_DIRECTORY.length));
    return `${scope}/${config.target}`;
}

/**
 * The path of a generated file of a scope: the one place that spells where a scope's files sit.
 * @param scope the scope path, empty for the root
 * @param name the file's path under the configuration directory
 * @returns the repository-relative path
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The one place that spells where the generated files of a scope sit.
export function scopeFile(scope: string, name: string): string {
    return scope === '' ? `${GSPOT_DIRECTORY}${name}` : `${GSPOT_DIRECTORY}${scope}/${name}`;
}

/**
 * The name a `{config:<name>}` placeholder uses for a target: the file name under .gspot without its extensions.
 * @param target the target path
 * @returns the name
 */
export function kitName(target: string): string {
    const bare = target.startsWith(GSPOT_DIRECTORY) ? target.slice(GSPOT_DIRECTORY.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}
