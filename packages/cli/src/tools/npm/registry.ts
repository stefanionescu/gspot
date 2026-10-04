// Read effective npm-compatible registry settings and retain credentials only in memory.
import which from 'which';
import Config from '@npmcli/config';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isRecord } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { CONNECTION_KEYS } from '#cli/config/tools/npm.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';

// Read and validate the native configuration before exposing its effective registry settings.
async function readRegistrySettings(root: string): Promise<Record<string, unknown>> {
    const inherited = environmentVariables();
    const npm = which.sync('npm', { nothrow: true });
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
            'Cannot load the repository registry settings. Check the package manager configuration.',
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
 * Read npm-compatible connection settings through npm's configuration owner, keeping credentials in memory.
 * @param root the repository root
 * @returns the environment variables that carry the registry settings
 */
export async function registryEnvironment(root: string): Promise<Record<string, string>> {
    const effective = await readRegistrySettings(root);
    const env: Record<string, string> = Object.fromEntries(
        Object.entries(effective)
            .filter(
                ([key]) =>
                    CONNECTION_KEYS.has(key) ||
                    /^@[^\s:=]+:registry$/u.test(key) ||
                    /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u.test(key),
            )
            .flatMap(([key, value]): [string, string][] => {
                if (value === undefined || value === null) return [];
                let text: string;
                if (Array.isArray(value)) text = value.join('\n\n');
                else text = typeof value === 'string' ? value : JSON.stringify(value);
                if (key.endsWith(':certfile') || key.endsWith(':keyfile')) text = resolve(root, text);
                return [[`npm_config_${key}`, text]];
            }),
    );
    const registry = env['npm_config_registry'];
    if (registry !== undefined) {
        env['BUN_CONFIG_REGISTRY'] = registry;
        env['YARN_REGISTRY'] = registry;
    }
    return env;
}
