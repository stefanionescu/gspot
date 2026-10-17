import { posix } from 'node:path';
import { test, expect } from 'bun:test';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { classifyToolVersion } from '#cli/tools/versions.ts';
import { readAsset, listAssets } from '#cli/system/assets.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import { RULE_NAME_FILES } from '#tests/data/configurations/manifests.ts';
import { ruleNamesFileSchema } from '#cli/generation/tool-files/stylelint.ts';
import { EACH_PLACEHOLDER, SETTING_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

test('each lint-rule list names the pinned package version', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const pins = listToolProjectPins(manifests).npm;
    for (const path of RULE_NAME_FILES) {
        const names = ruleNamesFileSchema.parse(JSON.parse(readAsset(path)));
        expect(pins[names.package], path).toBe(names.version);
    }
    for (const manifest of manifests.filter((manifest) => Object.keys(manifest.eslint.presets).length > 0)) {
        const presets = readPresets(manifest);
        expect(Object.keys(presets), manifest.configuration.name).toStrictEqual(Object.keys(manifest.eslint.presets));
        for (const [name, declaration] of Object.entries(manifest.eslint.presets))
            expect(presets[name], `${manifest.configuration.name}/${name}`).toMatchObject({
                package: declaration.package,
                source: declaration.source,
                version: pins[declaration.package],
            });
    }
});

/** List every version pin of a tool by installer and package name. */
function listToolPins(tool: ToolDeclaration): (readonly [string, string])[] {
    return [
        ...(tool.version === undefined ? [] : [[`tool:${tool.name}`, tool.version] as const]),
        ...Object.entries(tool.installers).flatMap(([installer, pin]) =>
            pin.version === undefined ? [] : [[`${installer}:${pin.name}`, pin.version] as const],
        ),
    ];
}

test('configurations agree on every tool and installer pin', () => {
    const versions = new Map<string, string>();
    const violations: string[] = [];
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const pins = manifests.flatMap(({ tools }) => tools).flatMap((tool) => listToolPins(tool));
    for (const [name, version] of pins) {
        const previous = versions.get(name);
        if (previous !== undefined && previous !== version) violations.push(`${name}: ${previous}, ${version}`);
        versions.set(name, version);
    }
    expect(violations).toStrictEqual([]);
});

/** Whether the pin of a tool sits below its minimum version. */
function hasOutdatedPin(tool: ToolDeclaration): boolean {
    return tool.version !== undefined && classifyToolVersion(tool.version, undefined, tool.min_version) === 'outdated';
}

test('each tool has a pin or a floor at or above it', () => {
    const violations: string[] = [];
    for (const manifest of readManifests(createReadCache(process.cwd())).values())
        for (const tool of manifest.tools) {
            const unpinned =
                tool.system !== true &&
                tool.version === undefined &&
                Object.values(tool.installers).some((pin) => pin.version === undefined);
            if ((unpinned && tool.min_version === undefined) || hasOutdatedPin(tool))
                violations.push(`${manifest.configuration.name}: ${tool.name}`);
        }
    expect(violations).toStrictEqual([]);
});

/** Find settings expanded by normal and repeated command placeholders. */
function commandSettings(check: CheckDeclaration): string[] {
    return [...(check.command ?? []), ...(check.fix ?? [])].flatMap((part) => {
        const repeated = EACH_PLACEHOLDER.exec(part)?.groups?.['setting'];
        return repeated === undefined
            ? [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? '')
            : [repeated];
    });
}

/** A declared default must provide a usable value unless the check waits for that setting. */
function hasEmptyDefault(setting: SettingDeclaration | undefined): boolean {
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
function checkSettingViolations(
    check: CheckDeclaration,
    declarations: ReadonlyMap<string, SettingDeclaration>,
): string[] {
    const awaited = check.when?.setting;
    const violations = awaited !== undefined && !declarations.has(awaited) ? [`${check.name}: ${awaited}`] : [];
    for (const name of commandSettings(check)) {
        if (name !== awaited && hasEmptyDefault(declarations.get(name))) violations.push(`${check.name}: ${name}`);
    }
    return violations;
}

test('a check waits for each setting with an empty default', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const declarations = buildKnownSettings(manifests, 'all').declarations;
    const violations = manifests.flatMap((manifest) =>
        manifest.checks.flatMap((check) => checkSettingViolations(check, declarations)),
    );
    expect(violations).toStrictEqual([]);
});

test('every default names a declared setting', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const declarations = buildKnownSettings(manifests, 'all').declarations;
    expect(
        manifests.flatMap((manifest) =>
            Object.keys(manifest.defaults)
                .filter((name) => !declarations.has(name))
                .map((name) => `${manifest.configuration.name}: ${name}`),
        ),
    ).toStrictEqual([]);
});

test('tool files and checks name declared tools and checks', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map(({ name }) => name)));
    const checks = new Set(manifests.flatMap((manifest) => manifest.checks.map(({ name }) => name)));
    const violations: string[] = [];
    for (const manifest of manifests) {
        const names = [
            ...manifest.toolFiles.flatMap((file) => [...file.tool, ...file.required_tools]),
            ...manifest.tools.flatMap((tool) => tool.requires ?? []),
            ...manifest.checks.flatMap((check) => [
                ...(check.tool === undefined ? [] : [check.tool]),
                ...(check.other_tools ?? []),
            ]),
        ];
        violations.push(
            ...names.filter((name) => !tools.has(name)).map((name) => `${manifest.configuration.name}: ${name}`),
            ...manifest.toolFiles.flatMap((file) => file.check.filter((name) => !checks.has(name))),
        );
    }
    expect(violations).toStrictEqual([]);
});

test('each conditional rule names a shipped rule file', () => {
    const violations: string[] = [];
    for (const manifest of readManifests(createReadCache(process.cwd())).values()) {
        const files = new Set(listAssets(`${manifest.folder}/rules/`).map((path) => posix.basename(path)));
        violations.push(
            ...Object.keys(manifest.rules)
                .filter((file) => !files.has(file))
                .map((file) => `${manifest.configuration.name}: ${file}`),
        );
    }
    expect(violations).toStrictEqual([]);
});

test('a check that needs a build, Docker, or the network does not run at the commit stage', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    expect(
        manifests.flatMap((manifest) =>
            manifest.checks
                .filter((check) => check.needs !== undefined && check.stage === 'commit')
                .map(({ name }) => name),
        ),
    ).toStrictEqual([]);
});
