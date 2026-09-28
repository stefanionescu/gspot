// Owns reads from the process environment and normalizes variables for tool execution.

import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
/**
 * True under a CI runner, which sets CI.
 * @returns whether CI is set
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: True under a CI runner, which sets CI. 3 files make 2 calls; one owner keeps that behavior in one place.
export function isCi(): boolean {
    return (process.env['CI'] ?? '') !== '';
}

/**
 * Where mise keeps its data, when MISE_DATA_DIR or XDG_DATA_HOME says so.
 * @returns the directory, or undefined for the default under the home directory
 */
export function miseHome(): string | undefined {
    if ((process.env['MISE_DATA_DIR'] ?? '') !== '') return process.env['MISE_DATA_DIR'];
    return (process.env['XDG_DATA_HOME'] ?? '') === '' ? undefined : `${process.env['XDG_DATA_HOME'] ?? ''}/mise`;
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
 * The platform cache directory; relative environment overrides are invalid.
 * @returns the absolute cache directory
 */
export function cacheHome(): string {
    if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches');
    const name = process.platform === 'win32' ? 'LOCALAPPDATA' : 'XDG_CACHE_HOME';
    const override = process.env[name];
    if (override !== undefined && override !== '') {
        if (!isAbsolute(override)) throw new Error(`${name} must name an absolute directory.`);
        return override;
    }
    return process.platform === 'win32' ? join(homedir(), 'AppData', 'Local') : join(homedir(), '.cache');
}

/**
 * Sets or clears one environment variable for this process and the tools it spawns.
 * @param name the variable
 * @param value the new value, or undefined to clear it
 */
export function setEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}
