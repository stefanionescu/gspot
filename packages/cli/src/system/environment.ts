import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { CACHE_FOLDER_NAME, OPERATING_SYSTEMS, CACHE_FOLDER_MESSAGE } from '#cli/config/system.ts';

function readSystemCacheFolder(): string | undefined {
    if (process.platform === 'win32') return readEnvironmentVariable('LOCALAPPDATA');
    return process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches') : join(homedir(), '.cache');
}

/**
Build the environment for tool processes. Merge Windows names that differ only in case, and keep their spelling.
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

export function readEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
}

export function readCacheFolder(): string {
    const cache = readEnvironmentVariable('XDG_CACHE_HOME') ?? readSystemCacheFolder();
    if (cache === undefined || !isAbsolute(cache)) throw new GspotError('filesystem', CACHE_FOLDER_MESSAGE);
    return join(cache, CACHE_FOLDER_NAME);
}

export function readHost(): { platform: string; arch: string } {
    return {
        platform:
            OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform,
        arch: process.arch,
    };
}

export function foldVariableName(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}
