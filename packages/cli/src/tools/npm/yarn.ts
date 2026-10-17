// Read Yarn connection settings for an isolated install.
import { z } from 'zod';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { YARN_SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { addEnvironmentReference } from '#cli/tools/npm/registry.ts';
import { GSPOT_PACKAGES } from '#cli/config/generation/file-edits.ts';
import { formatHold, readRootHoldDays } from '#cli/generation/release-holds.ts';

import {
    YARN_SECRET_KEYS,
    NPM_SETTING_PREFIX,
    YARN_CONNECTION_KEYS,
    YARN_CONFIG_GET_ARGUMENTS,
    YARN_ENVIRONMENT_SETTINGS,
    YARN_CONFIG_LIST_ARGUMENTS,
    YARN_INSTALL_SETTINGS_FILE,
    YARN_SETTING_VARIABLE_PREFIX,
} from '#cli/config/tools/npm.ts';

const yarnConnectionSettingsSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const yarnConfigEntrySchema = z.object({ key: z.string() } satisfies SchemaShape<{ key: string }>);

const yarnSettingSchema = z.json();

// Convert connection settings recursively while retaining secrets for redaction.
function convertToReference(value: unknown, key: string, env: Record<string, string>, secrets: string[]): unknown {
    if (typeof value === 'string') {
        if (YARN_SECRET_KEYS.has(key)) secrets.push(value);
        return addEnvironmentReference(env, YARN_SETTING_VARIABLE_PREFIX, value);
    }
    if (Array.isArray(value)) return value.map((entry) => convertToReference(entry, key, env, secrets));
    if (value !== null && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value).map(([name, entry]) => [name, convertToReference(entry, name, env, secrets)]),
        );
    return value;
}

// Read each Yarn environment setting and replace credential values with references.
function buildEnvironmentSettings(env: Record<string, string>, secrets: string[]): Record<string, unknown> {
    const environmentSettings = YARN_ENVIRONMENT_SETTINGS.flatMap<[string, unknown]>((source) => {
        const entries = Object.entries(env).flatMap<[string, unknown]>(([key, value]) => {
            const name = source.pattern.exec(key)?.[1];
            return name === undefined
                ? []
                : [
                      [
                          name,
                          { ...source.defaults, [source.field]: convertToReference(value, source.field, env, secrets) },
                      ],
                  ];
        });
        return entries.length === 0 ? [] : [[source.setting, Object.fromEntries(entries)]];
    });
    return Object.fromEntries<unknown>(environmentSettings);
}

/**
 * Write the scratch .yarnrc.yml with connection settings replaced by environment references, and add those variables to env.
 *
 * @param context what install needs for this step.
 * @param work the folder where the isolated project runs.
 * @param env the environment the install runs with, which receives the settings.
 *
 * @returns the credential values the lockfile must not contain.
 */
async function writeYarnSettings(
    context: InstallContext,
    work: string,
    env: Record<string, string>,
): Promise<string[]> {
    const { root, timeoutSeconds } = context.session;
    const settings = yarnConnectionSettingsSchema.parse(parse(readFileSync(join(work, YARN_SETTINGS_FILE), 'utf8')));
    const secrets: string[] = [];
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) {
        settings['npmRegistryServer'] = convertToReference(registry, 'npmRegistryServer', env, secrets);
        const url = new URL(registry);
        if (url.protocol === 'http:') settings['unsafeHttpWhitelist'] = [url.hostname];
    }
    Object.assign(settings, buildEnvironmentSettings(env, secrets));
    context.steps.push(YARN_CONFIG_LIST_ARGUMENTS);
    const listed = await runTool(YARN_CONFIG_LIST_ARGUMENTS, {
        cancelSignal: context.cancelSignal,
        cwd: root,
        env,
        timeoutSeconds,
    });
    context.cancelSignal?.throwIfAborted();
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
        const command = [...YARN_CONFIG_GET_ARGUMENTS, entry.key, '--json', '--no-redacted'];
        context.steps.push(command);
        const read = await runTool(command, { cancelSignal: context.cancelSignal, cwd: root, timeoutSeconds, env });
        context.cancelSignal?.throwIfAborted();
        if (read.code !== 0) throw new GspotError('installation', `Cannot read Yarn setting ${entry.key}.`);
        settings[entry.key] = convertToReference(
            yarnSettingSchema.parse(JSON.parse(read.stdout)),
            entry.key,
            env,
            secrets,
        );
    }
    settings['npmMinimalAgeGate'] = formatHold('minutes', readRootHoldDays(context.session.scopes));
    settings['npmPreapprovedPackages'] = [...GSPOT_PACKAGES];
    writeFileSync(join(work, YARN_INSTALL_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return secrets.filter((value) => value.length > 0);
}

export { writeYarnSettings };
