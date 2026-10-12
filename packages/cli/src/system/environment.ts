// Reads host information and constructs command environments.
import { isCI } from 'std-env';
import envPaths from 'env-paths';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';

import {
    MISE_FOLDER,
    MISE_DATA_FOLDER,
    XDG_DATA_VARIABLE,
    CACHE_FOLDER_NAME,
    MISE_DATA_VARIABLE,
} from '#cli/config/system/environment.ts';

/**
 * True when a person can answer a prompt: both standard streams use terminals and no continuous integration runner reports its presence.
 * @returns whether to prompt.
 */
export function isInteractive(): boolean {
    return process.stdin.isTTY && process.stdout.isTTY && !isCI;
}

/**
 * The mise data directory selected by MISE_DATA_DIR, XDG_DATA_HOME, or the home-directory default.
 * @returns the data directory.
 */
export function miseHome(): string {
    const configured = process.env[MISE_DATA_VARIABLE];
    if (configured !== undefined && configured !== '') return configured;
    const xdg = process.env[XDG_DATA_VARIABLE];
    return xdg === undefined || xdg === '' ? join(homedir(), MISE_DATA_FOLDER) : join(xdg, MISE_FOLDER);
}

/**
 * The environment for spawning tools, with Windows names normalized to uppercase.
 * @returns the variables as strings.
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
 * The gspot cache directory of the platform. Refuse relative cache environment paths.
 * @returns the absolute cache directory.
 */
export function cacheDirectory(): string {
    const { cache } = envPaths(CACHE_FOLDER_NAME, { suffix: '' });
    if (!isAbsolute(cache))
        throw new Error('The cache directory must be absolute; set XDG_CACHE_HOME or LOCALAPPDATA to one.');
    return cache;
}

/**
 * Translate the host name reported by Node for planning, doctor, and test operating system selection.
 * @returns the gspot name, or the original Node name for another operating system.
 */
export function currentOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}
