import envPaths from 'env-paths';
import { join, isAbsolute } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';

import {
    CACHE_FOLDER_NAME,
    OPERATING_SYSTEMS,
    CREDENTIAL_VARIABLE,
    TOOL_VARIABLE_NAMES,
    CACHE_FOLDER_MESSAGE,
    TOOL_OPT_OUT_VARIABLE,
    TOOL_VARIABLE_PREFIXES,
} from '#cli/config/system/environment.ts';

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
List the inherited variables that a tool which runs repository code does not get, such as credentials. Each one maps
to undefined, so that the spawn environment removes it.
*/
export function readWithheldVariables(): Record<string, undefined> {
    return Object.fromEntries(
        Object.keys(process.env)
            .filter((key) => {
                const name = key.toUpperCase();
                const isToolVariable =
                    TOOL_VARIABLE_NAMES.has(name) ||
                    TOOL_VARIABLE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
                    TOOL_OPT_OUT_VARIABLE.test(name);
                return !isToolVariable || CREDENTIAL_VARIABLE.test(name);
            })
            .map((key) => [key, undefined]),
    );
}

/**
Read one value from the process environment.

@param name the exact process environment key to read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Only configured environment readers access `process.env`.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Doctor, the mise installer, and check planning name this system through the one table of systems.
export function getOperatingSystem(): string {
    return OPERATING_SYSTEMS.find((platform) => platform.nodeName === process.platform)?.name ?? process.platform;
}

/**
Fold variable names for Windows comparisons.

@param name the environment variable name.
@returns the case that gspot compares variable names in.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Process, Git, and tool environments compare variable names in the Windows letter case through it.
export function foldVariableName(name: string): string {
    return process.platform === 'win32' ? name.toUpperCase() : name;
}
