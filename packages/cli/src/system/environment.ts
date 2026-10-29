import envPaths from 'env-paths';
import { join, isAbsolute } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { CACHE_FOLDER_NAME, OPERATING_SYSTEMS, CACHE_FOLDER_MESSAGE } from '#cli/config/system/environment.ts';

/**
Build the environment for tool processes. Merge Windows names that differ only in case, and keep their spelling.

@param overrides tool variables that replace or remove inherited values.
*/
export function buildSpawnEnvironment(overrides?: Record<string, string | undefined>): Record<string, string> {
    const variables = new Map<string, [string, string]>();
    const pairs = Object.entries(process.env);
    if (overrides !== undefined) pairs.push(...Object.entries(overrides));
    for (const [key, value] of pairs) {
        const name = foldVariableName(key);
        if (value === undefined) variables.delete(name);
        else variables.set(name, [key, value]);
    }
    return Object.fromEntries(variables.values());
}

/**
Read one value from the process environment.

@param name the exact process environment key to read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 17 calls in 14 files share it.
export function readEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
}

/**
Read the gspot cache folder of this system. Refuse a relative cache path from the environment.
*/
export function readCacheFolder(): string {
    const configured = readEnvironmentVariable('XDG_CACHE_HOME');
    const cache = configured === undefined ? envPaths(CACHE_FOLDER_NAME, { suffix: '' }).cache : configured;
    const folder = configured === undefined ? cache : join(cache, CACHE_FOLDER_NAME);
    if (!isAbsolute(cache)) throw new GspotError('filesystem', CACHE_FOLDER_MESSAGE);
    return folder;
}

/**
Translate the Node.js name of this system into the gspot name.

@returns the gspot name, or the Node name for another system.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 4 files share it.
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}

/**
Fold variable names for Windows comparisons.

@param name the environment variable name.
@returns the case that gspot compares variable names in.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function foldVariableName(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}
