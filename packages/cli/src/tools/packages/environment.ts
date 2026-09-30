import which from 'which';
import Config from '@npmcli/config';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CONNECTION_KEYS } from '#cli/config/tools/packages.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
// eslint-disable-next-line gspot/no-index-imports -- reason: The package defines flatten and shorthands in this file, and Vite reads them only from the explicit path.
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';

/**
 * Read npm-compatible connection settings through npm's configuration owner, keeping credentials in memory.
 * @param root the repository root
 * @returns the environment variables that carry the registry settings
 */
export async function packageEnvironment(root: string): Promise<Record<string, string>> {
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
        if (!config.validate()) throw new Error('Invalid package manager configuration.');
    } catch {
        throw new Error('Cannot load the repository registry settings. Check the package manager configuration.');
    }
    const effective: Record<string, unknown> = {};
    for (const layer of config.list.toReversed()) Object.assign(effective, layer);
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
