/** List every version pin of a tool by installer and package name. */

import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import type { Check } from '#cli/types/configurations.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { classifyToolVersion } from '#cli/tools/versions.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint/presets.ts';
import { EACH_PLACEHOLDER, SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';

/** Find settings expanded by normal and repeated command placeholders. */
function listCommandSettings(check: Check): string[] {
    return [...(check.command ?? []), ...(check.fix ?? [])].flatMap((part) => {
        const repeated = EACH_PLACEHOLDER.exec(part)?.groups?.['setting'];
        return repeated === undefined
            ? [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? '')
            : [repeated];
    });
}

/** A declared default must provide a usable value unless the check waits for that setting. */
function hasEmptyDefault(setting: Setting | undefined): boolean {
    const value = setting?.default;
    return (
        setting === undefined ||
        value === undefined ||
        value === '' ||
        value === false ||
        (Array.isArray(value) && value.length === 0)
    );
}

/** Report missing declarations and empty settings that a check expands without waiting. */
function listSettingMismatches(check: Check, declarations: ReadonlyMap<string, Setting>): string[] {
    const awaited = check.when?.setting;
    const mismatches = awaited !== undefined && !declarations.has(awaited) ? [`${check.id}: ${awaited}`] : [];
    for (const name of listCommandSettings(check)) {
        if (name !== awaited && hasEmptyDefault(declarations.get(name))) mismatches.push(`${check.id}: ${name}`);
    }
    return mismatches;
}

test('each lint-rule list names the pinned package version', () => {
    const configurations = [...readConfigurations().values()];
    const pins = listToolProjectPins(configurations).npm;
    expect(pins[pluginPackage.name]).toBe(pluginPackage.version);
    for (const path of listAssets('configurations/').filter((asset) => asset.endsWith('-names.json'))) {
        const names = nameListSchema.parse(JSON.parse(readFileSync(buildAssetPath(path), 'utf8')));
        expect(pins[names.package], path).toBe(names.version);
    }
    const presetFiles = new Set(
        listAssets('configurations/').filter((path) => path.endsWith(`/${ESLINT_PRESETS_FILE}`)),
    );
    for (const configuration of configurations.filter(({ folder }) =>
        presetFiles.has(`${folder}/${ESLINT_PRESETS_FILE}`),
    ))
        for (const [name, preset] of Object.entries(readPresets(configuration)))
            expect(pins[preset.package], `${configuration.name}/${name}`).toBe(preset.version);
});

test('configurations agree on every tool and installer pin', () => {
    const versions = new Map<string, string>();
    const mismatches: string[] = [];
    const configurations = [...readConfigurations().values()];
    const pins = configurations
        .flatMap(({ tools }) => tools)
        .flatMap((tool) => [
            ...(tool.version === undefined ? [] : [[`tool:${tool.name}`, tool.version] as const]),
            ...Object.entries(tool.installers).flatMap(([installer, pin]) =>
                pin.version === undefined ? [] : [[`${installer}:${pin.name}`, pin.version] as const],
            ),
        ]);
    for (const [name, version] of pins) {
        const previous = versions.get(name);
        if (previous !== undefined && previous !== version) mismatches.push(`${name}: ${previous}, ${version}`);
        versions.set(name, version);
    }
    expect(mismatches).toStrictEqual([]);
});

test('each tool has a pin or a minimum version at or above it', () => {
    const tools = [...readConfigurations().values()].flatMap((configuration) =>
        configuration.tools.map((tool) => ({ configuration: configuration.name, tool })),
    );
    const unpinned = tools.filter(
        ({ tool }) =>
            tool.system !== true &&
            tool.version === undefined &&
            tool.min_version === undefined &&
            Object.values(tool.installers).some((pin) => pin.version === undefined),
    );
    const outdated = tools.filter(
        ({ tool }) =>
            tool.version !== undefined && classifyToolVersion(tool.version, undefined, tool.min_version) === 'outdated',
    );
    expect([...unpinned, ...outdated].map(({ configuration, tool }) => `${configuration}: ${tool.name}`)).toStrictEqual(
        [],
    );
});

test('a check waits for each setting with an empty default', () => {
    const configurations = [...readConfigurations().values()];
    const declarations = buildKnownSettings(configurations, 'all').settings;
    const mismatches = configurations.flatMap((configuration) =>
        configuration.checks.flatMap((check) => listSettingMismatches(check, declarations)),
    );
    expect(mismatches).toStrictEqual([]);
});

test('every default names a declared setting', () => {
    const configurations = [...readConfigurations().values()];
    const declarations = buildKnownSettings(configurations, 'all').settings;
    expect(
        configurations.flatMap((configuration) =>
            Object.keys(configuration.defaults)
                .filter((name) => !declarations.has(name))
                .map((name) => `${configuration.name}: ${name}`),
        ),
    ).toStrictEqual([]);
});

test('tool files and checks name declared tools and checks', () => {
    const configurations = [...readConfigurations().values()];
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)));
    const checks = new Set(configurations.flatMap((configuration) => configuration.checks.map(({ id: name }) => name)));
    const mismatches: string[] = [];
    for (const configuration of configurations) {
        const names = [
            ...configuration.toolFiles.flatMap((file) => file.tool),
            ...configuration.eslint.required_tools,
            ...configuration.tools.flatMap((tool) => tool.requires ?? []),
            ...configuration.checks.flatMap((check) => [
                ...(check.tool === undefined ? [] : [check.tool]),
                ...(check.other_tools ?? []),
            ]),
        ];
        mismatches.push(
            ...names.filter((name) => !tools.has(name)).map((name) => `${configuration.name}: ${name}`),
            ...configuration.toolFiles.flatMap((file) => file.check.filter((name) => !checks.has(name))),
        );
    }
    expect(mismatches).toStrictEqual([]);
});

test('each conditional rule names a shipped rule file', () => {
    const mismatches: string[] = [];
    for (const configuration of readConfigurations().values()) {
        const files = new Set(listAssets(`${configuration.folder}/rules/`).map((path) => posix.basename(path)));
        mismatches.push(
            ...Object.keys(configuration.rules)
                .filter((file) => !files.has(file))
                .map((file) => `${configuration.name}: ${file}`),
        );
    }
    expect(mismatches).toStrictEqual([]);
});

test('a check that needs a build, Docker, or the network does not run at the commit stage', () => {
    const configurations = [...readConfigurations().values()];
    expect(
        configurations.flatMap((configuration) =>
            configuration.checks
                .filter((check) => check.needs !== undefined && check.stage === 'commit')
                .map(({ id: name }) => name),
        ),
    ).toStrictEqual([]);
});
