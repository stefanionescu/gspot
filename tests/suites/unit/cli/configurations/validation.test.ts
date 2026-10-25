import semver from 'semver';
import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { Tool, Check, NameList } from '#cli/types/configurations.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { EACH_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { SettingDefinition } from '#cli/types/settings/definitions.ts';
import { eslintPresetsSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';

function listToolPinErrors(tool: Tool): string[] {
    const version = semver.coerce(tool.version);
    const minimum = semver.coerce(tool.min_version);
    const isOutdated = version !== null && minimum !== null && semver.lt(version, minimum);
    const isUnpinned =
        tool.system !== true &&
        tool.version === undefined &&
        tool.min_version === undefined &&
        Object.values(tool.installers).some((pin) => pin.version === undefined);
    return [
        ...(isOutdated
            ? [`tool ${tool.name} pins ${String(tool.version)} below its minimum ${String(tool.min_version)}.`]
            : []),
        ...(isUnpinned ? [`tool ${tool.name} has no version pin or minimum.`] : []),
    ];
}

function readInstallerVersions(): { versions: Map<string, string>; errors: string[] } {
    const versions = new Map<string, string>();
    const errors: string[] = [];
    const pins = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.tools)
        .flatMap((tool) => Object.entries(tool.installers));
    for (const [installer, pin] of pins) {
        if (pin.version === undefined) continue;
        const key = `${installer}:${pin.name}`;
        const previous = versions.get(key);
        versions.set(key, pin.version);
        if (previous !== undefined && previous !== pin.version)
            errors.push(`${key} has conflicting versions ${previous} and ${pin.version}.`);
    }
    return { versions, errors };
}

function readExportedNameLists(folder: string): Pick<NameList, 'package' | 'version'>[] {
    return listAssets(`${folder}/`)
        .filter((path) => path.endsWith('-names.json') || path.endsWith(`/${ESLINT_PRESETS_FILE}`))
        .flatMap((path): Pick<NameList, 'package' | 'version'>[] => {
            const parsed: unknown = JSON.parse(readFileSync(buildAssetPath(path), 'utf8'));
            return path.endsWith('-names.json')
                ? [nameListSchema.parse(parsed)]
                : Object.values(eslintPresetsSchema.parse(parsed));
        });
}

function hasEmptyDefault(declaration: SettingDefinition | undefined, value: unknown): boolean {
    if (declaration === undefined) return true;
    const selected = value ?? declaration.default_all ?? declaration.default;
    return (
        selected === undefined ||
        selected === '' ||
        selected === false ||
        (Array.isArray(selected) && selected.length === 0)
    );
}

function listCommandSettings(check: Check): string[] {
    return [...(check.command ?? []), ...(check.fix ?? [])].flatMap((argument) => {
        const repeated = EACH_PLACEHOLDER.exec(argument)?.groups?.['setting'];
        return repeated === undefined
            ? argument
                  .matchAll(SETTING_PLACEHOLDER)
                  .map((match) => match.groups?.['name'] ?? '')
                  .toArray()
            : repeated;
    });
}

function listCheckSettingErrors(check: Check, defaults: Record<string, unknown>): string[] {
    const declarations: Readonly<Record<string, SettingDefinition>> = SETTING_DEFINITIONS;
    const requiredSetting = check.when?.setting;
    return [
        ...(requiredSetting !== undefined && declarations[requiredSetting] === undefined
            ? [`${check.id} waits for undeclared setting ${requiredSetting}.`]
            : []),
        ...listCommandSettings(check)
            .filter((name) => name !== requiredSetting && hasEmptyDefault(declarations[name], defaults[name]))
            .map((name) => `${check.id} uses empty-default setting ${name} without when.setting.`),
    ];
}

test('each shipped tool has a version pin or minimum, and no pin below its minimum', () => {
    const errors = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.tools.flatMap((tool) => listToolPinErrors(tool)))
        .toArray();
    expect(errors).toStrictEqual([]);
});

test('each shipped installer package has one version across the configurations', () => {
    expect(readInstallerVersions().errors).toStrictEqual([]);
});

test('the config files, requirements, and checks of each configuration name declared tools and checks', () => {
    const configurations = readConfigurations().values().toArray();
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)));
    const checks = new Set(configurations.flatMap((configuration) => configuration.checks.map(({ id }) => id)));
    const errors = configurations.flatMap((configuration) => [
        ...[
            ...configuration.configFiles.flatMap((file) => file.tool),
            ...configuration.eslint.required_tools,
            ...configuration.tools.flatMap((tool) => tool.requires ?? []),
            ...configuration.checks.flatMap((check) => [
                ...(check.tool === undefined ? [] : [check.tool]),
                ...(check.other_tools ?? []),
            ]),
        ]
            .filter((name) => !tools.has(name))
            .map((name) => `${configuration.name}: tool ${name} has no declaration.`),
        ...configuration.configFiles
            .flatMap((file) => file.check)
            .filter((name) => !checks.has(name))
            .map((name) => `${configuration.name}: check ${name} has no declaration.`),
    ]);
    expect(errors).toStrictEqual([]);
});

test('each conditional rule of a configuration has a shipped rule file', () => {
    const errors = readConfigurations()
        .values()
        .flatMap((configuration) => {
            const rules = new Set(listAssets(`${configuration.folder}/rules/`).map((path) => posix.basename(path)));
            return Object.keys(configuration.rules)
                .filter((name) => !rules.has(name))
                .map((name) => `${configuration.name}: conditional rule ${name} has no shipped rule file.`);
        })
        .toArray();
    expect(errors).toStrictEqual([]);
});

test('each copied linter name list and preset matches the npm pin of its package', () => {
    const { versions } = readInstallerVersions();
    const errors = readConfigurations()
        .values()
        .flatMap((configuration) => readExportedNameLists(configuration.folder))
        .filter((exported) => versions.get(`npm:${exported.package}`) !== exported.version)
        .map((exported) => `${exported.package} snapshot version ${exported.version} does not match its npm pin.`)
        .toArray();
    expect(errors).toStrictEqual([]);
});

test('each manifest default names a declared setting', () => {
    const errors = readConfigurations()
        .values()
        .flatMap((configuration) =>
            Object.keys(configuration.defaults)
                .filter((name) => !Object.hasOwn(SETTING_DEFINITIONS, name))
                .map((name) => `${configuration.name}: default ${name} has no setting declaration.`),
        )
        .toArray();
    expect(errors).toStrictEqual([]);
});

test('each check waits for declared settings and runs at a stage that has the resources it needs', () => {
    const configurations = readConfigurations().values().toArray();
    const defaults = Object.fromEntries(
        configurations.flatMap((configuration) => Object.entries(configuration.defaults)),
    );
    const errors = configurations.flatMap((configuration) =>
        configuration.checks.flatMap((check) => [
            ...listCheckSettingErrors(check, defaults),
            ...(check.needs !== undefined && check.stage === 'commit'
                ? [`${check.id} needs resources unavailable at the commit stage.`]
                : []),
        ]),
    );
    expect(errors).toStrictEqual([]);
});
