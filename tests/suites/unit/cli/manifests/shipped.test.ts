import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { expect, test } from 'bun:test';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import semver from 'semver';
import { visit } from 'unist-util-visit';
import type { z } from 'zod';

import { EACH_PLACEHOLDER } from '#cli/config/engine.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { buildAssetPath, listAssets } from '#cli/system/assets.ts';
import type { Check, Tool } from '#cli/types/manifests.ts';
import type { SettingDefinition } from '#cli/types/settings.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };

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

function hasEmptyDefault(schema: z.ZodType | undefined, value: unknown): boolean {
    if (schema === undefined) return true;
    const definition = schema.meta() as SettingDefinition | undefined;
    const parsed = schema.safeParse(undefined);
    const selected = value ?? definition?.default_all ?? (parsed.success ? parsed.data : undefined);
    return new Set<unknown>([undefined, '', false]).has(selected) || (Array.isArray(selected) && selected.length === 0);
}

function listCommandSettings(check: Check): string[] {
    return [...(check.command ?? []), ...(check.fix ?? [])].flatMap((argument) => {
        const repeated = EACH_PLACEHOLDER.exec(argument)?.groups?.['setting'];
        return (
            repeated ??
            argument
                .matchAll(SETTING_PLACEHOLDER)
                .map((match) => match.groups?.['name'] ?? '')
                .toArray()
        );
    });
}

function listCheckSettingErrors(check: Check, defaults: Record<string, unknown>): string[] {
    const requiredSetting = check.when?.setting;
    return [
        ...(requiredSetting !== undefined && findSettingSchema(requiredSetting) === undefined
            ? [`${check.id} waits for undeclared setting ${requiredSetting}.`]
            : []),
        ...listCommandSettings(check)
            .filter((name) => name !== requiredSetting && hasEmptyDefault(findSettingSchema(name), defaults[name]))
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
            ...configuration.configs.flatMap((file) => file.tool),
            ...configuration.eslint.required_tools,
            ...configuration.tools.flatMap((tool) => tool.requires ?? []),
            ...configuration.checks.flatMap((check) => [
                ...(check.tool === undefined ? [] : [check.tool]),
                ...(check.secondary_tools ?? []),
            ]),
        ]
            .filter((name) => !tools.has(name))
            .map((name) => `${configuration.name}: tool ${name} has no declaration.`),
        ...configuration.configs
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
                .filter((name) => findSettingSchema(name) === undefined)
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
            ...(!new Set(check.needs).isSubsetOf(new Set(['dependencies'])) && check.stage === 'commit'
                ? [`${check.id} needs resources unavailable at the commit stage.`]
                : []),
        ]),
    );
    expect(errors).toStrictEqual([]);
});

test('shipped configuration folders have unique names', () => {
    const names = listAssets('src/configurations/')
        .filter((path) => path.endsWith('/manifest.toml'))
        .map((path) => posix.basename(posix.dirname(path)));
    expect(new Set(names).size).toBe(names.length);
});

test('each check that maps lint rules to limits names the tool that reads them', () => {
    const unnamed = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.checks)
        .filter((check) => check.limits !== undefined && !Array.isArray(check.limits))
        .filter((check) => (check.tool ?? check.command?.[0]) === undefined)
        .map((check) => check.id)
        .toArray();
    expect(unnamed).toStrictEqual([]);
});

test('no two configurations ship a rule file of the same name', () => {
    const names = readConfigurations()
        .values()
        .flatMap((configuration) => listRuleFiles(configuration).map(({ path }) => path))
        .toArray();
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toStrictEqual([]);
});

test('each tool has one declaration, which every configuration that names the tool shares', () => {
    const tools = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.tools)
        .toArray();
    const repeated = Map.groupBy(new Set(tools), (tool) => tool.name)
        .entries()
        .filter(([, declarations]) => declarations.length > 1)
        .map(([name]) => name)
        .toArray();
    expect(repeated).toStrictEqual([]);
});

test('every shipped Markdown table parses as a table instead of a paragraph', () => {
    const errors: string[] = [];
    const rules = listAssets('src/configurations/').filter((path) => path.includes('/rules/') && path.endsWith('.md'));
    for (const path of rules) {
        const text = readFileSync(buildAssetPath(path), 'utf8');
        const document = fromMarkdown(text, {
            extensions: [gfmTable()],
            mdastExtensions: [gfmTableFromMarkdown()],
        });
        visit(document, 'paragraph', (paragraph) => {
            const { position } = paragraph;
            if (position === undefined) return;
            const lines = text.split('\n').slice(position.start.line - 1, position.end.line);
            if (lines.some((line) => line.trimStart().startsWith('|'))) {
                errors.push(`${path}:${String(position.start.line)}: table rows parsed as a paragraph.`);
            }
        });
    }
    expect(errors).toStrictEqual([]);
});
