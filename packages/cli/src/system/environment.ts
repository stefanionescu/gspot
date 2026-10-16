// Reads host information and constructs command environments.
import { isCI } from 'std-env';
import envPaths from 'env-paths';
import { isAbsolute } from 'node:path';
import { CACHE_FOLDER_NAME } from '#cli/config/system/environment.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';

/**
 * True when a person can answer a prompt: both standard streams use terminals and no continuous integration runner reports its presence.
 * @returns whether to prompt.
 */
export function isInteractive(): boolean {
    return process.stdin.isTTY && process.stdout.isTTY && !isCI;
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
