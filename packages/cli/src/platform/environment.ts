// Reads the host and process environment for tool execution.

import { isCI } from 'std-env';
import envPaths from 'env-paths';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';

/**
 * True when a person can answer a prompt: both standard streams are terminals and no CI runner is detected.
 * @returns whether to prompt
 */
export function isInteractive(): boolean {
    return process.stdin.isTTY && process.stdout.isTTY && !isCI;
}

/**
 * The mise data directory selected by MISE_DATA_DIR, XDG_DATA_HOME, or the home-directory default.
 * @returns the data directory
 */
export function miseHome(): string {
    const configured = process.env['MISE_DATA_DIR'];
    if (configured !== undefined && configured !== '') return configured;
    const xdg = process.env['XDG_DATA_HOME'];
    return xdg === undefined || xdg === '' ? join(homedir(), '.local', 'share', 'mise') : join(xdg, 'mise');
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

/**
 * Translate the host name reported by Node for planning, doctor, and native test selection.
 * @returns the gspot name, or the original Node name for another operating system
 */
export function hostPlatform(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.node === process.platform)?.name ?? process.platform;
}
