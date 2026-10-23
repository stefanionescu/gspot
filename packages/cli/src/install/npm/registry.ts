// Read npm registry settings and write isolated package manager settings.
import which from 'which';
import Config from '@npmcli/config';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { join, dirname, resolve } from 'node:path';
import { realpathSync, writeFileSync } from 'node:fs';
import { NPM_TOOL } from '#cli/config/repository/npm.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { extractUrlPasswords } from '#cli/install/credentials.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';
import { NPMRC_FILE, NPM_SETTING_PREFIX } from '#cli/config/install/npm/project.ts';

import {
    CREDENTIAL_KEY,
    CONNECTION_KEYS,
    REGISTRY_ALIASES,
    CERTIFICATE_KEYS,
    REGISTRY_AUTH_KEY,
    CONNECTION_URL_KEY,
    NPM_SCOPE_REGISTRY_KEY,
    ENCODED_CREDENTIAL_KEY,
    NPM_SETTING_VARIABLE_PREFIX,
} from '#cli/config/install/npm/registry.ts';

// Read and validate the npm settings before returning the registry settings that apply.
async function readRegistrySettings(root: string): Promise<Record<string, unknown>> {
    const inherited = buildSpawnEnvironment();
    const npm = which.sync(NPM_TOOL, { nothrow: true });
    const npmPath = npm === null ? dirname(process.execPath) : dirname(dirname(realpathSync(npm)));
    const config = new Config({
        npmPath,
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
        throw new GspotError('install', 'Cannot read the registry settings. Check the .npmrc files.', {
            cause: error,
        });
    }
    let valid: boolean;
    try {
        valid = config.validate();
    } catch (error) {
        if (isTable(error) && error['code'] === 'ERR_INVALID_URL')
            throw new GspotError('install', 'A registry URL in the .npmrc files is not valid.');
        throw error;
    }
    if (!valid) throw new GspotError('install', 'The .npmrc settings are not valid.');
    const effective: Record<string, unknown> = {};
    for (const layer of config.list.toReversed()) Object.assign(effective, layer);
    return effective;
}

/**
 * Add a connection setting under an unused environment variable and return its reference.
 *
 * @param env the install variables that get the value.
 * @param prefix the start of each variable name.
 * @param value the connection setting kept out of generated files.
 *
 * @returns a package-manager environment reference.
 */
export function addEnvironmentReference(env: Record<string, string>, prefix: string, value: string): string {
    let index = 0;
    while (Object.hasOwn(env, `${prefix}${String(index)}`)) index += 1;
    const name = `${prefix}${String(index)}`;
    env[name] = value;
    return `\${${name}}`;
}

/**
 * Collect raw, decoded, and URL-encoded secrets. Lockfile checks and message redaction use them.
 *
 * @param env variables for the tool process.
 *
 * @returns the registry secrets that messages must hide.
 */
export function extractRegistryCredentials(env: Record<string, string>): string[] {
    const credentials = Object.entries(env)
        .filter(([key]) => CREDENTIAL_KEY.test(key))
        .map(([, value]) => value)
        .filter((value) => value.length > 0);
    const encoded = Object.entries(env)
        .filter(([key]) => ENCODED_CREDENTIAL_KEY.test(key))
        .flatMap(([key, value]) => {
            const decoded = Buffer.from(value, 'base64').toString('utf8');
            return key.endsWith('_auth') ? [decoded, decoded.slice(decoded.indexOf(':') + 1)] : [decoded];
        });
    const passwords = Object.entries(env)
        .filter(([key]) => CONNECTION_URL_KEY.test(key))
        .flatMap(([, value]) => extractUrlPasswords(value));
    return [...credentials, ...encoded, ...passwords];
}

/**
 * Write npm connection settings through environment references, so the temporary .npmrc contains no credentials.
 *
 * @param settingsFolder the private user settings folder.
 * @param env variables for the tool process.
 */
export function writeNpmrc(settingsFolder: string, env: Record<string, string>): void {
    const references: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith(NPM_SETTING_PREFIX)) continue;
        const reference = addEnvironmentReference(env, NPM_SETTING_VARIABLE_PREFIX, value);
        references.push(`${key.slice(NPM_SETTING_PREFIX.length)}=${reference}`);
    }
    writeFileSync(join(settingsFolder, NPMRC_FILE), `${references.join('\n')}\n`, { mode: PRIVATE_FILE });
}

/**
 * Read npm-compatible connection settings through the npm settings file, and keep credentials in memory.
 *
 * @param repositoryRoot the working folder for npm settings and relative certificate paths.
 *
 * @returns the environment variables that carry the registry settings.
 */
export async function readRegistryEnvironment(repositoryRoot: string): Promise<Record<string, string>> {
    const effective = await readRegistrySettings(repositoryRoot);
    const env: Record<string, string> = Object.fromEntries(
        Object.entries(effective)
            .filter(
                ([key]) => CONNECTION_KEYS.has(key) || NPM_SCOPE_REGISTRY_KEY.test(key) || REGISTRY_AUTH_KEY.test(key),
            )
            .flatMap(([key, value]): [string, string][] => {
                if (value === undefined || value === null) return [];
                let text: string;
                if (Array.isArray(value)) text = value.join('\n\n');
                else text = typeof value === 'string' ? value : JSON.stringify(value);
                if (CERTIFICATE_KEYS.some((suffix) => key.endsWith(suffix))) text = resolve(repositoryRoot, text);
                return [[`${NPM_SETTING_PREFIX}${key}`, text]];
            }),
    );
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) {
        for (const alias of REGISTRY_ALIASES) env[alias] = registry;
    }
    return env;
}
