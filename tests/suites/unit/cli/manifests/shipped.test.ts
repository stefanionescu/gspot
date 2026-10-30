import semver from 'semver';
import { posix } from 'node:path';
import { test, expect } from 'bun:test';
import { listAssets } from '#cli/system/assets.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { manifestToolSchema } from '#cli/schemas/manifests/tool.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { EACH_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { SettingDefinition } from '#cli/types/settings/definitions.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

test('each accepted suppression example matches its marker and gives a reason', () => {
    const forms = readConfigurations()
        .values()
        .flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
                tool.suppression === undefined || tool.suppression.forbidden === true
                    ? []
                    : { name: tool.name, ...tool.suppression },
            ),
        )
        .toArray();
    for (const form of forms) {
        const example = form.example ?? '';
        const markers = [form.marker, form.inline_marker ?? form.marker].map((pattern) => new RegExp(pattern, 'u'));
        expect(
            markers.some((marker) => marker.test(example)),
            form.name,
        ).toBe(true);
        expect(new RegExp(form.reason, 'u').exec(example)?.groups?.['reason'], form.name).toMatch(/\S/u);
    }
});

test('the javascript manifest pins the workspace version of @gspothq/eslint-plugin', () => {
    const javascript = readConfigurations().get('javascript');
    expect(javascript?.tools.find((tool) => tool.installers['npm']?.name === '@gspothq/eslint-plugin')?.version).toBe(
        pluginPackage.version,
    );
});

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

function hasEmptyDefault(definition: SettingDefinition | undefined, value: unknown): boolean {
    if (definition === undefined) return true;
    const selected = value ?? definition.default_all ?? definition.default;
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

test('shipped configuration folders have unique names', () => {
    const names = listAssets('configurations/')
        .filter((path) => path.endsWith('/manifest.toml'))
        .map((path) => posix.basename(posix.dirname(path)));
    expect(new Set(names).size).toBe(names.length);
});

test('a mise installer refuses a checksum without a sha256 digest and accepts one with it', () => {
    const tool = { name: 'taplo', version: '0.10.0' };
    const invalid = { ...tool, mise: { name: 'taplo', checksums: { 'linux-x64': 'invalid' } } };
    const valid = { ...tool, mise: { name: 'taplo', checksums: { 'linux-x64': `sha256:${'a'.repeat(64)}` } } };
    expect(manifestToolSchema.safeParse(invalid).success).toBe(false);
    expect(manifestToolSchema.safeParse(valid).success).toBe(true);
});
