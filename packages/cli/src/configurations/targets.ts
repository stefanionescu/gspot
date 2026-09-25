import { CONFIGURATION_DIRECTORY } from '#cli/platform/paths.ts';
import type { ConfigurationTarget } from '#cli/configurations/schema.ts';

const GSPOT_DIRECTORY = `${CONFIGURATION_DIRECTORY}/`;

/**
 * The path of a configuration for a check in one scope: a target written for each scope lives under that scope.
 * @param scope the scope path, empty for the root
 * @param config the configuration target
 * @returns the repository-relative path
 */
export function targetInScope(scope: string, config: ConfigurationTarget): string {
    if (scope === '' || !config.per_scope) return config.target;
    if (config.target.startsWith(GSPOT_DIRECTORY))
        return `${GSPOT_DIRECTORY}${scope}/${config.target.slice(GSPOT_DIRECTORY.length)}`;
    return `${scope}/${config.target}`;
}

/**
 * The name a `{config:<name>}` placeholder uses for a target: the file name under .gspot without its extensions.
 * @param target the target path
 * @returns the name
 */
export function configurationName(target: string): string {
    const bare = target.startsWith(GSPOT_DIRECTORY) ? target.slice(GSPOT_DIRECTORY.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}
