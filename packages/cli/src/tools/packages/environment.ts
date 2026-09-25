import { environmentVariables } from '#cli/platform/environment.ts';
import Config from '@npmcli/config';
import { definitions, flatten, shorthands } from '@npmcli/config/lib/definitions/index.js';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CONNECTION_KEYS = new Set([
    'registry',
    'proxy',
    'https-proxy',
    'noproxy',
    'strict-ssl',
    'ca',
    'cafile',
    'cert',
    'key',
    'always-auth',
]);

/**
 * Read npm-compatible connection settings through npm's configuration owner, keeping credentials in memory.
 * @param root
 */
export async function packageEnvironment(root: string): Promise<Record<string, string>> {
    const inherited = environmentVariables();
    const npm = Bun.which('npm');
    const npmPath = npm === null ? dirname(process.execPath) : dirname(dirname(realpathSync(npm)));
    const config = new Config({
        npmPath,
        definitions,
        flatten,
        shorthands,
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
    const effective: Record<string, unknown> = Object.assign({}, ...config.list.toReversed());
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(effective)) {
        if (
            !CONNECTION_KEYS.has(key) &&
            !/^@[^\s:=]+:registry$/u.test(key) &&
            !/^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u.test(key)
        )
            continue;
        if (value === undefined || value === null) continue;
        let text = Array.isArray(value) ? value.join('\n\n') : String(value);
        if (key.endsWith(':certfile') || key.endsWith(':keyfile')) text = resolve(root, text);
        env[`npm_config_${key}`] = text;
    }
    if (inherited['GSPOT_REGISTRY'] !== undefined) env['npm_config_registry'] = inherited['GSPOT_REGISTRY'];
    const registry = env['npm_config_registry'];
    if (registry !== undefined) {
        env['BUN_CONFIG_REGISTRY'] = registry;
        env['YARN_REGISTRY'] = registry;
    }
    return env;
}
