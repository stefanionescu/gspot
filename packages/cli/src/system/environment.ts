import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { CACHE_FOLDER_MESSAGE, CACHE_FOLDER_NAME, OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';

/**
Read the cache folder of this system: LOCALAPPDATA on Windows, ~/Library/Caches on macOS, and ~/.cache elsewhere.
*/
function readSystemCacheFolder(): string | undefined {
    if (process.platform === 'win32') return readEnvironmentVariable('LOCALAPPDATA');
    return process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches') : join(homedir(), '.cache');
}

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
export function readEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
}

/**
Read the gspot cache folder from XDG_CACHE_HOME, or else from the cache folder of this system. Refuse a missing or
relative cache path.
*/
export function readCacheFolder(): string {
    const cache = readEnvironmentVariable('XDG_CACHE_HOME') ?? readSystemCacheFolder();
    if (cache === undefined || !isAbsolute(cache)) throw new GspotError('filesystem', CACHE_FOLDER_MESSAGE);
    return join(cache, CACHE_FOLDER_NAME);
}

/**
Translate the Node.js name of this system into the gspot name.

@returns the gspot name, or the Node name for another system.
*/
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}

/**
Fold variable names for Windows comparisons.

@param name the environment variable name.
@returns the case that gspot compares variable names in.
*/
export function foldVariableName(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}
