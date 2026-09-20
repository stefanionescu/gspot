// Where a scope keeps what a command names: its own copy of a configuration, and whether the package manager knows it.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { ConfigurationTarget } from '#types/manifest.ts';

const GSPOT_DIRECTORY = '.gspot/';

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
 * The baseline file a tool keeps for one scope. A tool that rewrites its whole file on every write names the scope in the
 * path with a placeholder, so two scopes never share a file; the root is written as root, and a slash in a scope path as a dash.
 * @param file the baseline_file of the check
 * @param scope the scope path, empty for the root
 * @returns the repository-relative path
 */
export function toolBaselineFile(file: string, scope: string): string {
    return file.replaceAll('{scope}', () => (scope === '' ? 'root' : scope.replaceAll('/', '-')));
}

/**
 * Whether a scope is a package the package manager knows: a workspace flag names only a folder with a package.json.
 * @param root the repository root
 * @param scope the scope path
 * @returns true for a scope that holds a package.json
 */
export function isWorkspace(root: string, scope: string): boolean {
    return scope !== '' && existsSync(join(root, scope, 'package.json'));
}
