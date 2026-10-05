import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { addEnvironmentReference } from '#cli/tools/credentials.ts';
import { yarnSettingSchema, yarnConfigEntrySchema, yarnConnectionSettingsSchema } from '#cli/parsers/schema/yarn.ts';

import {
    YARN_CONNECTION_KEYS,
    YARN_ENVIRONMENT_SETTINGS,
    YARN_SETTING_VARIABLE_PREFIX,
} from '#cli/config/tools/npm.ts';

/**
 * Write the scratch .yarnrc.yml with connection settings replaced by environment references, and add those variables to env.
 * @param root the repository root
 * @param work the directory the isolated project runs in
 * @param env the environment the install runs with, which receives the settings
 * @returns the credential values the lock must not contain
 */
export async function yarnSettings(root: string, work: string, env: Record<string, string>): Promise<string[]> {
    const settings = yarnConnectionSettingsSchema.parse(parse(readFileSync(join(work, '.yarnrc.yml'), 'utf8')));
    const secrets: string[] = [];
    const reference = (value: unknown, key: string): unknown => {
        if (typeof value === 'string') {
            if (key === 'npmAuthToken' || key === 'npmAuthIdent') secrets.push(value);
            return addEnvironmentReference(env, YARN_SETTING_VARIABLE_PREFIX, value);
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
    const listed = await runTool(['yarn', 'config', '--json', '--no-defaults'], { cwd: root, env });
    if (listed.code !== 0)
        throw new GspotError(
            'installation',
            'Cannot read Yarn connection settings. Check the repository Yarn configuration.',
        );
    const entries = listed.stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => yarnConfigEntrySchema.parse(JSON.parse(line)))
        .filter((entry) => YARN_CONNECTION_KEYS.has(entry.key));
    for (const entry of entries) {
        const read = await runTool(['yarn', 'config', 'get', entry.key, '--json', '--no-redacted'], {
            cwd: root,
            env,
        });
        if (read.code !== 0) throw new GspotError('installation', `Cannot read Yarn setting ${entry.key}.`);
        settings[entry.key] = reference(yarnSettingSchema.parse(JSON.parse(read.stdout)), entry.key);
    }
    writeFileSync(join(work, '.yarnrc.yml'), stringify(settings), { mode: PRIVATE_FILE });
    return secrets.filter((value) => value.length > 0);
}
