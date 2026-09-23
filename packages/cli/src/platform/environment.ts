import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { HOOK_FILES } from '#cli/checks/integrity-definitions.ts';
// The one place gspot reads the environment: every variable it honors has a function here.

function isSet(name: string): boolean {
    const value = process.env[name];
    return value !== undefined && value !== '';
}

/**
 * True under a CI runner, which sets CI.
 * @returns whether CI is set
 */
export function isCi(): boolean {
    return isSet('CI');
}

/**
 * True when NO_COLOR asks for plain output.
 * @returns whether NO_COLOR is set
 */
export function isColorRefused(): boolean {
    return isSet('NO_COLOR');
}

/**
 * The parallelism GSPOT_JOBS asks for, when it names a positive integer.
 * @returns the count, or undefined
 */
export function jobsWanted(): number | undefined {
    const wanted = Number(process.env['GSPOT_JOBS'] ?? '');
    return Number.isSafeInteger(wanted) && wanted > 0 ? wanted : undefined;
}

/**
 * Where mise keeps its data, when MISE_DATA_DIR or XDG_DATA_HOME says so.
 * @returns the directory, or undefined for the default under the home directory
 */
export function miseHome(): string | undefined {
    if (isSet('MISE_DATA_DIR')) return process.env['MISE_DATA_DIR'];
    return isSet('XDG_DATA_HOME') ? `${process.env['XDG_DATA_HOME'] ?? ''}/mise` : undefined;
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

/** The supported Git hook that invoked this process. */
export function invokingHook(): (typeof HOOK_FILES)[number] | undefined {
    return HOOK_FILES.find((name) => name === process.env['GSPOT_HOOK']);
}

/** The platform cache directory; relative environment overrides are invalid. */
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
