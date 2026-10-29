import { join } from 'node:path';
import { stringify } from 'yaml';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { runInstallStep } from '#cli/installers/steps.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { YARN_SETTINGS_FILE } from '#cli/config/files/names.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { addEnvironmentReference } from '#cli/installers/npm/registry.ts';
import { NPM_SETTING_PREFIX } from '#cli/config/installers/npm/project.ts';
import { MINUTES_PER_DAY } from '#cli/config/installers/npm/release-age.ts';
import { buildPackageManagerCommand } from '#cli/repository/npm/package-manager.ts';
import { yarnSettingsSchema, yarnConfigSettingSchema } from '#cli/schemas/installers/npm/yarn.ts';

import {
    YARN_SECRET_KEYS,
    YARN_SETTING_KEYS,
    YARN_CONNECTION_KEYS,
    YARN_CONFIG_GET_FLAGS,
    YARN_CONFIG_GET_ARGUMENTS,
    YARN_ENVIRONMENT_SETTINGS,
    YARN_INSTALL_SETTINGS_FILE,
    YARN_CONFIG_LIST_ARGUMENTS,
    YARN_SETTING_VARIABLE_PREFIX,
} from '#cli/config/installers/npm/yarn.ts';

function convertToReference(value: unknown, key: string, env: Record<string, string>, secrets: string[]): unknown {
    if (typeof value === 'string') {
        if (YARN_SECRET_KEYS.has(key)) secrets.push(value);
        return addEnvironmentReference(env, YARN_SETTING_VARIABLE_PREFIX, value);
    }
    if (Array.isArray(value)) return value.map((element) => convertToReference(element, key, env, secrets));
    if (value !== null && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value).map(([name, child]) => [name, convertToReference(child, name, env, secrets)]),
        );
    return value;
}

function buildEnvironmentSettings(env: Record<string, string>, secrets: string[]): Record<string, unknown> {
    const environmentSettings = YARN_ENVIRONMENT_SETTINGS.flatMap<[string, unknown]>((source) => {
        const pairs = Object.entries(env).flatMap<[string, unknown]>(([key, value]) => {
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
        return pairs.length === 0 ? [] : [[source.setting, Object.fromEntries(pairs)]];
    });
    return Object.fromEntries<unknown>(environmentSettings);
}

/**
Write the .yarnrc-install.yml of the temporary project with environment references in place of its connection
settings, and add those variables to env.

@param install what install needs for this step.
@param runFolder the folder where the isolated project runs.
@param env variables for the install; the settings go here too.
@returns the credential values the lockfile must not contain.
*/
export async function writeYarnSettings(
    install: ToolInstall,
    runFolder: string,
    env: Record<string, string>,
): Promise<string[]> {
    const { root } = install.session;
    const yarnPackageManager = { name: 'yarn', version: install.session.packageManager?.version };
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
    const listed = await runInstallStep(
        install,
        buildPackageManagerCommand(yarnPackageManager, YARN_CONFIG_LIST_ARGUMENTS),
        { cwd: root, env },
    );
    if (listed.code !== 0)
        throw new GspotError('install', 'Cannot read the Yarn connection settings. Check .yarnrc.yml.');
    const connectionSettings = listed.stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseToolReport('yarn config', line, yarnConfigSettingSchema))
        .filter((setting) => YARN_CONNECTION_KEYS.has(setting.key));
    for (const setting of connectionSettings) {
        const command = [...YARN_CONFIG_GET_ARGUMENTS, setting.key, ...YARN_CONFIG_GET_FLAGS];
        const read = await runInstallStep(install, buildPackageManagerCommand(yarnPackageManager, command), {
            cwd: root,
            env,
        });
        if (read.code !== 0) throw new GspotError('install', `Cannot read Yarn setting ${setting.key}.`);
        settings[setting.key] = convertToReference(
            parseToolReport('yarn config get', read.stdout),
            setting.key,
            env,
            secrets,
        );
    }
    settings[YARN_SETTING_KEYS.npmMinimalAgeGate] = install.minimumReleaseAge.days * MINUTES_PER_DAY;
    settings[YARN_SETTING_KEYS.npmPreapprovedPackages] = install.minimumReleaseAge.npmExclusions;
    writeFileSync(join(runFolder, YARN_INSTALL_SETTINGS_FILE), stringify(settings), { mode: PRIVATE_FILE });
    return secrets.filter((value) => value.length > 0);
}
