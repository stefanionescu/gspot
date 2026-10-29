import which from 'which';
import Config from '@npmcli/config';
import { join, dirname, resolve } from 'node:path';
import { realpathSync, writeFileSync } from 'node:fs';
import { NPM_TOOL } from '#cli/config/repository/npm.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';
import { extractUrlPasswords } from '#cli/installers/credentials.ts';
import { NPMRC_FILE, NPM_SETTING_PREFIX } from '#cli/config/installers/npm/project.ts';

import {
    CREDENTIAL_KEY,
    CONNECTION_KEYS,
    CERTIFICATE_KEYS,
    REGISTRY_AUTH_KEY,
    CONNECTION_URL_KEY,
    REGISTRY_URL_MESSAGE,
    READ_REGISTRY_MESSAGE,
    NPMRC_SETTINGS_MESSAGE,
    NPM_SCOPE_REGISTRY_KEY,
    ENCODED_CREDENTIAL_KEY,
    NPM_SETTING_VARIABLE_PREFIX,
} from '#cli/config/installers/npm/registry.ts';

async function readRegistrySettings(root: string): Promise<Record<string, unknown>> {
    const inherited = buildSpawnEnvironment();
    const npmPath = readNpmPath();
    const config = new Config({
        npmPath,
        execPath: which.sync('node', { nothrow: true }) ?? process.execPath,
        definitions: npmDefinitions.definitions,
        flatten: npmDefinitions.flatten,
        shorthands: npmDefinitions.shorthands,
        argv: [],
        env: inherited,
        cwd: root,
    });
    try {
        await config.load();
    } catch (error) {
        throw new GspotError('install', READ_REGISTRY_MESSAGE, {
            cause: error,
        });
    }
    let valid: boolean;
    try {
        valid = config.validate();
    } catch (error) {
        if (error instanceof URIError || hasErrorCode(error, 'ERR_INVALID_URL'))
            throw new GspotError('install', REGISTRY_URL_MESSAGE, { cause: error });
        throw error;
    }
    if (!valid) throw new GspotError('install', NPMRC_SETTINGS_MESSAGE);
    const merged: Record<string, unknown> = {};
    for (const layer of config.list.toReversed()) Object.assign(merged, layer);
    return merged;
}

/**
Add a connection setting under an unused environment variable and return its reference.

@param environment the install variables that get the value.
@param prefix the start of each variable name.
@param value the connection setting kept out of generated files.
*/
function addEnvironmentReference(environment: Record<string, string>, prefix: string, value: string): string {
    let index = 0;
    while (Object.hasOwn(environment, `${prefix}${String(index)}`)) index += 1;
    const name = `${prefix}${String(index)}`;
    environment[name] = value;
    return `\${${name}}`;
}

/**
Collect the raw, decoded, and URL-encoded secrets.

@param environment variables for the tool process.
*/
export function extractRegistryCredentials(environment: Record<string, string>): string[] {
    const credentials = Object.entries(environment)
        .filter(([key]) => CREDENTIAL_KEY.test(key))
        .map(([, value]) => value)
        .filter((value) => value.length > 0);
    const encoded = Object.entries(environment)
        .filter(([key]) => ENCODED_CREDENTIAL_KEY.test(key))
        .flatMap(([key, value]) => {
            const decoded = Buffer.from(value, 'base64').toString('utf8');
            return key.endsWith('_auth') ? [decoded, decoded.slice(decoded.indexOf(':') + 1)] : [decoded];
        });
    const passwords = Object.entries(environment)
        .filter(([key]) => CONNECTION_URL_KEY.test(key))
        .flatMap(([, value]) => extractUrlPasswords(value));
    return [...credentials, ...encoded, ...passwords];
}

/**
Write npm connection settings through environment references, so the temporary .npmrc contains no credentials.

@param settingsFolder the private user settings folder.
@param environment variables for the tool process.
*/
export function writeNpmrc(settingsFolder: string, environment: Record<string, string>): void {
    const references: string[] = [];
    for (const [key, value] of Object.entries(environment)) {
        if (!key.startsWith(NPM_SETTING_PREFIX)) continue;
        const reference = addEnvironmentReference(environment, NPM_SETTING_VARIABLE_PREFIX, value);
        references.push(`${key.slice(NPM_SETTING_PREFIX.length)}=${reference}`);
    }
    writeFileSync(join(settingsFolder, NPMRC_FILE), `${references.join('\n')}\n`, { mode: PRIVATE_FILE });
}

/**
Read npm-compatible connection settings through the npm settings file, and keep credentials in memory.

@param root the working folder for npm settings and relative certificate paths.
*/
export async function readRegistryEnvironment(root: string): Promise<Record<string, string>> {
    const merged = await readRegistrySettings(root);
    const env: Record<string, string> = Object.fromEntries(
        Object.entries(merged)
            .filter(
                ([key]) => CONNECTION_KEYS.has(key) || NPM_SCOPE_REGISTRY_KEY.test(key) || REGISTRY_AUTH_KEY.test(key),
            )
            .flatMap(([key, value]): [string, string][] => {
                if (value === undefined || value === null) return [];
                let text: string;
                if (Array.isArray(value)) text = value.join('\n\n');
                else text = typeof value === 'string' ? value : JSON.stringify(value);
                if (CERTIFICATE_KEYS.some((suffix) => key.endsWith(suffix))) text = resolve(root, text);
                return [[`${NPM_SETTING_PREFIX}${key}`, text]];
            }),
    );
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) env['BUN_CONFIG_REGISTRY'] = registry;
    return env;
}

function readNpmPath(): string {
    const npm = which.sync(NPM_TOOL, { nothrow: true });
    if (npm === null) return dirname(process.execPath);
    return process.platform === 'win32'
        ? join(dirname(npm), 'node_modules', 'npm')
        : dirname(dirname(realpathSync(npm)));
}
