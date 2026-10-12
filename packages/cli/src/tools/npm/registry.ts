import which from 'which';
import Config from '@npmcli/config';
import { isRecord } from '#cli/objects.ts';
import { GspotError } from '#cli/errors.ts';
import { join, dirname, resolve } from 'node:path';
import { realpathSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { registryPasswords } from '#cli/tools/diagnostics.ts';
import { environmentVariables } from '#cli/system/environment.ts';
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';

import {
    NPMRC_FILE,
    NPM_PROGRAM,
    CREDENTIAL_KEY,
    CONNECTION_KEYS,
    CERTIFICATE_KEYS,
    REGISTRY_ALIASES,
    REGISTRY_AUTH_KEY,
    CONNECTION_URL_KEY,
    NPM_SETTING_PREFIX,
    ENCODED_CREDENTIAL_KEY,
    NPM_SCOPE_REGISTRY_KEY,
    PACKAGE_SETTING_VARIABLE_PREFIX,
} from '#cli/config/tools/npm.ts';

// Read and validate the configuration before exposing its effective registry settings.
async function readRegistrySettings(root: string): Promise<Record<string, unknown>> {
    const inherited = environmentVariables();
    const npm = which.sync(NPM_PROGRAM, { nothrow: true });
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
    } catch {
        throw new GspotError(
            'installation',
            'Cannot read the registry settings. Check the package manager configuration.',
        );
    }
    let valid: boolean;
    try {
        valid = config.validate();
    } catch (error) {
        if (isRecord(error) && error['code'] === 'ERR_INVALID_URL')
            throw new GspotError('installation', 'Invalid registry URL in package manager configuration.');
        throw error;
    }
    if (!valid) throw new GspotError('installation', 'Invalid package manager configuration.');
    const effective: Record<string, unknown> = {};
    for (const layer of config.list.toReversed()) Object.assign(effective, layer);
    return effective;
}

/**
 * Add a connection setting under an unused environment variable and return its reference.
 *
 * @param env the installation environment receiving the value.
 * @param prefix the variable prefix for this package manager.
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

// Retain raw, decoded, and URL-encoded secrets for lockfile validation and diagnostic redaction.
/**
 * Select credentials for refusal checks and diagnostic redaction.
 *
 * @param env the environment for the tool process.
 *
 * @returns the registry secrets that diagnostics must redact.
 */
export function registryCredentials(env: Record<string, string>): string[] {
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
        .flatMap(([, value]) => registryPasswords(value));
    return [...credentials, ...encoded, ...passwords];
}

// Package managers read environment references so the temporary .npmrc contains no credentials.
/**
 * Write npm connection settings through environment references.
 *
 * @param work the private user configuration directory.
 * @param env the environment for the tool process.
 */
export function writeNpmrc(work: string, env: Record<string, string>): void {
    const references: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith(NPM_SETTING_PREFIX)) continue;
        const reference = addEnvironmentReference(env, PACKAGE_SETTING_VARIABLE_PREFIX, value);
        references.push(`${key.slice(NPM_SETTING_PREFIX.length)}=${reference}`);
    }
    writeFileSync(join(work, NPMRC_FILE), `${references.join('\n')}\n`, { mode: PRIVATE_FILE });
}

/**
 * Read npm-compatible connection settings through the npm configuration owner, keeping credentials in memory.
 *
 * @param root the repository root.
 *
 * @returns the environment variables that carry the registry settings.
 */
export async function registryEnvironment(root: string): Promise<Record<string, string>> {
    const effective = await readRegistrySettings(root);
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
                if (CERTIFICATE_KEYS.some((suffix) => key.endsWith(suffix))) text = resolve(root, text);
                return [[`${NPM_SETTING_PREFIX}${key}`, text]];
            }),
    );
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) {
        for (const alias of REGISTRY_ALIASES) env[alias] = registry;
    }
    return env;
}
