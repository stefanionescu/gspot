import { z } from 'zod';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { readFileSync, writeFileSync } from 'node:fs';
import { runToolCommand } from '#cli/tools/command.ts';
import { YARN_CONNECTION_KEYS, YARN_ENVIRONMENT_SETTINGS } from '#cli/constants/tools/packages.ts';

/**
 * Read Yarn-owned connection settings and give its isolated project environment references.
 * @param root the repository root
 * @param work the directory the isolated project runs in
 * @param env the environment the install runs with, which receives the settings
 * @returns the credential values the lock must not contain
 */
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
            const name = `GSPOT_YARN_SETTING_${String(variable)}`;
            variable += 1;
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
    const environmentSettings = YARN_ENVIRONMENT_SETTINGS.flatMap((source) => {
        const entries = Object.entries(env).flatMap(([key, value]) => {
            const name = source.pattern.exec(key)?.[1];
            return name === undefined
                ? []
                : [[name, { ...source.defaults, [source.field]: reference(value, source.field) }]];
        });
        return entries.length === 0 ? [] : [[source.setting, Object.fromEntries(entries)]];
    });
    Object.assign(settings, Object.fromEntries(environmentSettings));
    const listed = await runToolCommand(undefined, ['yarn', 'config', '--json', '--no-defaults'], { cwd: root, env });
    if (listed.code !== 0)
        throw new Error('Cannot read Yarn connection settings. Check the repository Yarn configuration.');
    const entries = listed.stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => z.object({ key: z.string() }).parse(JSON.parse(line)))
        .filter((entry) => YARN_CONNECTION_KEYS.has(entry.key));
    for (const entry of entries) {
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
