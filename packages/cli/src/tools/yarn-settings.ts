import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { runToolCommand } from '#cli/run/tool-runner.ts';

const KEYS = new Set([
    'npmRegistryServer',
    'npmRegistries',
    'npmScopes',
    'npmAuthToken',
    'npmAuthIdent',
    'npmAlwaysAuth',
    'httpProxy',
    'httpsProxy',
    'enableStrictSsl',
    'httpsCaFilePath',
    'httpsCertFilePath',
    'httpsKeyFilePath',
    'networkSettings',
    'unsafeHttpWhitelist',
]);

/** Read Yarn-owned connection settings and give its isolated project environment references. */
export async function yarnSettings(root: string, work: string, env: Record<string, string>): Promise<string[]> {
    delete env['YARN_REGISTRY'];
    const settings: Record<string, unknown> = z
        .record(z.string(), z.unknown())
        .parse(parse(readFileSync(join(work, '.yarnrc.yml'), 'utf8')));
    const secrets: string[] = [];
    let variable = 0;
    const reference = (value: unknown, key: string): unknown => {
        if (typeof value === 'string') {
            if (key === 'npmAuthToken' || key === 'npmAuthIdent') secrets.push(value);
            const name = `GSPOT_YARN_SETTING_${variable++}`;
            env[name] = value;
            return `\${${name}}`;
        }
        if (Array.isArray(value)) return value.map((entry) => reference(entry, key));
        if (value !== null && typeof value === 'object')
            return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, reference(entry, name)]));
        return value;
    };
    const registry = env['npm_config_registry'];
    if (registry !== undefined) {
        settings['npmRegistryServer'] = reference(registry, 'npmRegistryServer');
        const url = new URL(registry);
        if (url.protocol === 'http:') settings['unsafeHttpWhitelist'] = [url.hostname];
    }
    const registries: Record<string, Record<string, unknown>> = {};
    const scopes: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(env)) {
        const scoped = /^npm_config_@([^:]+):registry$/u.exec(key);
        if (scoped !== null) scopes[scoped[1]!] = { npmRegistryServer: reference(value, 'npmRegistryServer') };
        const token = /^npm_config_(\/\/[^\s]+):_authToken$/u.exec(key);
        if (token !== null)
            registries[token[1]!] = { npmAuthToken: reference(value, 'npmAuthToken'), npmAlwaysAuth: true };
    }
    if (Object.keys(registries).length > 0) settings['npmRegistries'] = registries;
    if (Object.keys(scopes).length > 0) settings['npmScopes'] = scopes;
    const listed = await runToolCommand(undefined, ['yarn', 'config', '--json', '--no-defaults'], { cwd: root, env });
    if (listed.code !== 0)
        throw new Error('Cannot read Yarn connection settings. Check the repository Yarn configuration.');
    for (const line of listed.stdout.split('\n').filter((line) => line.trim() !== '')) {
        const entry = z.object({ key: z.string() }).parse(JSON.parse(line));
        if (!KEYS.has(entry.key)) continue;
        const read = await runToolCommand(undefined, ['yarn', 'config', 'get', entry.key, '--json', '--no-redacted'], {
            cwd: root,
            env,
        });
        if (read.code !== 0) throw new Error(`Cannot read Yarn setting ${entry.key}.`);
        settings[entry.key] = reference(z.json().parse(JSON.parse(read.stdout)), entry.key);
    }
    writeFileSync(join(work, '.yarnrc.yml'), stringify(settings), { mode: 0o600 });
    return secrets.filter((value) => value.length > 0);
}
