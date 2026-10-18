// Read system information and build command environments.
import envPaths from 'env-paths';
import { isAbsolute } from 'node:path';
import { CACHE_FOLDER_NAME } from '#cli/config/system/environment.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';

/**
 * Build the environment for tool processes. Merge Windows names that differ only in case, and keep their spelling.
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
 * Build the comparison key of an environment variable name for this system.
 * @param name the environment variable to key.
 * @returns its comparison key.
 */
export function normalizeEnvironmentKey(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}

/**
 * Find how an environment spells the key of the executable search path. Windows matches names in any case.
 * @param env the environment variables.
 * @returns the key, or undefined when the environment has none.
 */
export function findPathKey(env: Readonly<Record<string, unknown>>): string | undefined {
    return Object.keys(env).find((name) => normalizeEnvironmentKey(name) === 'PATH');
}

/**
 * Read the gspot cache folder of this system. Refuse a relative cache path from the environment.
 * @returns the absolute cache folder.
 */
export function readCacheFolder(): string {
    const { cache } = envPaths(CACHE_FOLDER_NAME, { suffix: '' });
    if (!isAbsolute(cache))
        throw new Error(
            'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.',
        );
    return cache;
}

/**
 * Translate the system name from Node for planning, doctor, and tests.
 * @returns the gspot name, or the Node name for another system.
 */
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}
