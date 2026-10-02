// Owns reads from the process environment and normalizes variables for tool execution.

import { isCI } from 'std-env';
import envPaths from 'env-paths';
import { isAbsolute } from 'node:path';

/**
 * True when a person can answer a prompt: both standard streams are terminals and no CI runner is detected.
 * @returns whether to prompt
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The three prompts ask this one question before they open.
export function isInteractive(): boolean {
    return process.stdin.isTTY && process.stdout.isTTY && !isCI;
}

/**
 * Where mise keeps its data, when MISE_DATA_DIR or XDG_DATA_HOME says so.
 * @returns the directory, or undefined for the default under the home directory
 */
export function miseHome(): string | undefined {
    if ((process.env['MISE_DATA_DIR'] ?? '') !== '') return process.env['MISE_DATA_DIR'];
    return (process.env['XDG_DATA_HOME'] ?? '') === '' ? undefined : `${process.env['XDG_DATA_HOME'] ?? ''}/mise`;
}

/**
 * The environment for spawning tools, with Windows names normalized to uppercase.
 * @returns the variables as strings
 */
export function environmentVariables(): Record<string, string> {
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        const name = process.platform === 'win32' ? key.toUpperCase() : key;
        if (value !== undefined) variables[name] = value;
    }
    return variables;
}

/**
 * The gspot cache directory of the platform. A relative XDG_CACHE_HOME or LOCALAPPDATA is refused.
 * @returns the absolute cache directory
 */
export function cacheDirectory(): string {
    const { cache } = envPaths('gspot', { suffix: '' });
    if (!isAbsolute(cache))
        throw new Error('The cache directory must be absolute; set XDG_CACHE_HOME or LOCALAPPDATA to one.');
    return cache;
}
