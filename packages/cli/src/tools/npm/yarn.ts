// Validate Yarn settings before passing connection values to an isolated install.
import { z } from 'zod';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { GspotError } from '#cli/errors.ts';
import { runTool } from '#cli/tools/run.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SchemaShape } from '#cli/types/objects.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { addEnvironmentReference } from '#cli/tools/npm/registry.ts';

import {
    YARN_CONFIG_GET,
    YARN_CONFIG_LIST,
    YARN_SECRET_KEYS,
    NPM_SETTING_PREFIX,
    YARN_CONNECTION_KEYS,
    YARN_ENVIRONMENT_SETTINGS,
    YARN_INSTALL_SETTINGS_FILE,
    YARN_SETTING_VARIABLE_PREFIX,
} from '#cli/config/tools/npm.ts';

const yarnConnectionSettingsSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const yarnConfigEntrySchema = z.object({ key: z.string() } satisfies SchemaShape<{ key: string }>);

const yarnSettingSchema = z.json();

// Convert connection settings recursively while retaining secrets for redaction.
function yarnReference(value: unknown, key: string, env: Record<string, string>, secrets: string[]): unknown {
    if (typeof value === 'string') {
        if (new Set<string>(YARN_SECRET_KEYS).has(key)) secrets.push(value);
        return addEnvironmentReference(env, YARN_SETTING_VARIABLE_PREFIX, value);
    }
    if (Array.isArray(value)) return value.map((entry) => yarnReference(entry, key, env, secrets));
    if (value !== null && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value).map(([name, entry]) => [name, yarnReference(entry, name, env, secrets)]),
        );
    return value;
}

/**
 * Write the scratch .yarnrc.yml with connection settings replaced by environment references, and add those variables to env.
 *
 * @param root the repository root.
 * @param work the directory the isolated project runs in.
 * @param env the environment the install runs with, which receives the settings.
 * @param timeoutSeconds the tool timeout in seconds.
 * @param steps the commands attempted during installation.
 *
 * @returns the credential values the lockfile must not contain.
 */
export async function yarnSettings(
    root: string,
    work: string,
    env: Record<string, string>,
    timeoutSeconds: number,
    steps: (readonly string[])[],
): Promise<string[]> {
    const settings = yarnConnectionSettingsSchema.parse(parse(readFileSync(join(work, '.yarnrc.yml'), 'utf8')));
    const secrets: string[] = [];
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) {
        settings['npmRegistryServer'] = yarnReference(registry, 'npmRegistryServer', env, secrets);
        const url = new URL(registry);
        if (url.protocol === 'http:') settings['unsafeHttpWhitelist'] = [url.hostname];
    }
    const environmentSettings = YARN_ENVIRONMENT_SETTINGS.flatMap((source) => {
        const entries = Object.entries(env).flatMap(([key, value]) => {
            const name = source.pattern.exec(key)?.[1];
            return name === undefined
                ? []
                : [[name, { ...source.defaults, [source.field]: yarnReference(value, source.field, env, secrets) }]];
        });
        return entries.length === 0 ? [] : [[source.setting, Object.fromEntries(entries)]];
    });
    Object.assign(settings, Object.fromEntries(environmentSettings));
    steps.push(YARN_CONFIG_LIST);
    const listed = await runTool(YARN_CONFIG_LIST, { cwd: root, env, timeoutSeconds });
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
        const command = [...YARN_CONFIG_GET, entry.key, '--json', '--no-redacted'];
        steps.push(command);
        const read = await runTool(command, {
            cwd: root,
            timeoutSeconds,
            env,
        });
        if (read.code !== 0) throw new GspotError('installation', `Cannot read Yarn setting ${entry.key}.`);
        settings[entry.key] = yarnReference(yarnSettingSchema.parse(JSON.parse(read.stdout)), entry.key, env, secrets);
    }
    writeFileSync(join(work, YARN_INSTALL_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return secrets.filter((value) => value.length > 0);
}
