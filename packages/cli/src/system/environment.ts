// Read system information and build command environments.
import envPaths from 'env-paths';
import { isAbsolute } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { CACHE_FOLDER_NAME, OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';

/**
 * Build the environment for tool processes. Merge Windows names that differ only in case, and keep their spelling.
 *
 * @param overrides tool variables that replace or remove inherited values.
 * @returns the variables as strings.
 */
export function buildSpawnEnvironment(overrides?: Record<string, string | undefined>): Record<string, string> {
    const variables = new Map<string, [string, string]>();
    const pairs = Object.entries(process.env);
    if (overrides !== undefined) pairs.push(...Object.entries(overrides));
    for (const [key, value] of pairs) {
        // Windows matches environment names in any case.
        const name = process.platform === 'win32' ? key.toUpperCase() : key;
        if (value === undefined) variables.delete(name);
        else variables.set(name, [key, value]);
    }
    return Object.fromEntries(variables.values());
}

/**
 * Read one value from the process environment.
 *
 * @param name the exact process environment key to read.
 * @returns the value when present.
 */
export function readEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
}

/**
 * Read the gspot cache folder of this system. Refuse a relative cache path from the environment.
 *
 * @returns the absolute cache folder.
 */
export function readCacheFolder(): string {
    const { cache } = envPaths(CACHE_FOLDER_NAME, { suffix: '' });
    if (!isAbsolute(cache))
        throw new GspotError(
            'filesystem',
            'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.',
        );
    return cache;
}

/**
 * Translate the Node.js name of this system into the gspot name.
 *
 * @returns the gspot name, or the Node name for another system.
 */
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}
