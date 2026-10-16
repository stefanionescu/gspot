// Reads host information and constructs command environments.
import envPaths from 'env-paths';
import { isAbsolute } from 'node:path';
import { CACHE_FOLDER_NAME } from '#cli/config/system/environment.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';

/**
 * The environment for spawning tools, with Windows identities merged without changing their spelling.
 * @param overrides tool variables that replace or remove inherited values.
 * @returns the variables as strings.
 */
export function buildSpawnEnvironment(overrides?: Record<string, string | undefined>): Record<string, string> {
    const variables = new Map<string, [string, string]>();
    const entries = Object.entries(process.env);
    if (overrides !== undefined) entries.push(...Object.entries(overrides));
    for (const [key, value] of entries) {
        const name = normalizeEnvironmentKey(key);
        if (value === undefined) variables.delete(name);
        else variables.set(name, [key, value]);
    }
    return Object.fromEntries(variables.values());
}

/**
 * Read one value from the process environment.
 * @param name the exact process environment key to read.
 * @returns the value when present.
 */
export function readEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
}

/**
 * Compare plain-record environment keys by their system identity.
 * @param name the variable name.
 * @returns its comparison key.
 */
export function normalizeEnvironmentKey(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}

/**
 * The gspot cache directory of the platform. Refuse relative cache environment paths.
 * @returns the absolute cache directory.
 */
export function readCacheFolder(): string {
    const { cache } = envPaths(CACHE_FOLDER_NAME, { suffix: '' });
    if (!isAbsolute(cache))
        throw new Error('The cache directory must be absolute; set XDG_CACHE_HOME or LOCALAPPDATA to one.');
    return cache;
}

/**
 * Translate the host name reported by Node for planning, doctor, and test operating system selection.
 * @returns the gspot name, or the original Node name for another operating system.
 */
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}
