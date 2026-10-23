import { join } from 'node:path';
import { stringify } from 'yaml';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInstallStep } from '#cli/install/steps.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { addEnvironmentReference } from '#cli/install/npm/registry.ts';
import { NPM_SETTING_PREFIX } from '#cli/config/install/npm/project.ts';
import { GSPOT_PACKAGES, MINUTES_PER_DAY } from '#cli/config/install/npm/release-age.ts';
import { yarnSettingsSchema, yarnConfigEntrySchema } from '#cli/schemas/install/npm/yarn.ts';

import {
    YARN_SECRET_KEYS,
    YARN_SETTING_KEYS,
    YARN_SETTINGS_FILE,
    YARN_CONNECTION_KEYS,
    YARN_CONFIG_GET_FLAGS,
    YARN_CONFIG_GET_ARGUMENTS,
    YARN_ENVIRONMENT_SETTINGS,
    YARN_INSTALL_SETTINGS_FILE,
    YARN_CONFIG_LIST_ARGUMENTS,
    YARN_SETTING_VARIABLE_PREFIX,
} from '#cli/config/install/npm/yarn.ts';

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
 * Write the .yarnrc-install.yml of the temporary project with environment references in place of its connection
 * settings, and add those variables to env.
 *
 * @param install what install needs for this step.
 * @param runFolder the folder where the isolated project runs.
 * @param env variables for the install; the settings go here too.
 * @returns the credential values the lockfile must not contain.
 */
export async function writeYarnSettings(
    install: ToolInstall,
    runFolder: string,
    env: Record<string, string>,
): Promise<string[]> {
    const { root } = install.session;
    const settings = parseYamlFile(
        join(runFolder, YARN_SETTINGS_FILE),
        readFileSync(join(runFolder, YARN_SETTINGS_FILE), 'utf8'),
        yarnSettingsSchema,
    );
    const secrets: string[] = [];
    const registry = env[`${NPM_SETTING_PREFIX}registry`];
    if (registry !== undefined) {
        settings[YARN_SETTING_KEYS.npmRegistryServer] = convertToReference(
            registry,
            YARN_SETTING_KEYS.npmRegistryServer,
            env,
            secrets,
        );
        const url = new URL(registry);
        if (url.protocol === 'http:') settings[YARN_SETTING_KEYS.unsafeHttpWhitelist] = [url.hostname];
    }
    Object.assign(settings, buildEnvironmentSettings(env, secrets));
    const listed = await runInstallStep(install, YARN_CONFIG_LIST_ARGUMENTS, { cwd: root, env });
    if (listed.code !== 0)
        throw new GspotError('install', 'Cannot read the Yarn connection settings. Check .yarnrc.yml.');
    const entries = listed.stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseToolReport('yarn config', line, yarnConfigEntrySchema))
        .filter((entry) => YARN_CONNECTION_KEYS.has(entry.key));
    for (const entry of entries) {
        const command = [...YARN_CONFIG_GET_ARGUMENTS, entry.key, ...YARN_CONFIG_GET_FLAGS];
        const read = await runInstallStep(install, command, { cwd: root, env });
        if (read.code !== 0) throw new GspotError('install', `Cannot read Yarn setting ${entry.key}.`);
        settings[entry.key] = convertToReference(
            parseToolReport('yarn config get', read.stdout),
            entry.key,
            env,
            secrets,
        );
    }
    settings[YARN_SETTING_KEYS.npmMinimalAgeGate] =
        getTable(findRootScope(install.session.scopes).settings, 'dependencies').min_release_age_days * MINUTES_PER_DAY;
    settings[YARN_SETTING_KEYS.npmPreapprovedPackages] = [...GSPOT_PACKAGES];
    writeFileSync(join(runFolder, YARN_INSTALL_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return secrets.filter((value) => value.length > 0);
}
