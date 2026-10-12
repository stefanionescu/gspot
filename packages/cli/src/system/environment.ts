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
 * The environment for spawning tools, with Windows identities merged without changing their spelling.
 * @param overrides tool variables that replace or remove inherited values.
 * @returns the variables as strings.
 */
export function environmentVariables(overrides?: Record<string, string | undefined>): Record<string, string> {
    const variables = new Map<string, [string, string]>();
    const entries = Object.entries(process.env);
    if (overrides !== undefined) entries.push(...Object.entries(overrides));
    for (const [key, value] of entries) {
        const name = process.platform === 'win32' ? key.toUpperCase() : key;
        if (value === undefined) variables.delete(name);
        else variables.set(name, [key, value]);
    }
    return Object.fromEntries(variables.values());
}

/**
 * Read one environment value using the system's variable-name identity.
 * @param variables the environment to read.
 * @param name the variable name.
 * @returns its value when present.
 */
export function environmentVariable(variables: Record<string, string | undefined>, name: string): string | undefined {
    const key =
        process.platform === 'win32'
            ? Object.keys(variables).find((candidate) => candidate.toUpperCase() === name.toUpperCase())
            : name;
    return key === undefined ? undefined : variables[key];
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
