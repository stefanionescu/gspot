import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/platform/assets.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    SEMGREP_ASSETS,
    TOOL_DECLARATION,
    SECURITY_DECLARATION,
    SUPPRESSION_DECLARATION,
    SYNTAX_SELECTOR_DECLARATION,
} from '#tests/config/cli/parsers/configurations.ts';

test('the folder gives a configuration its name and kind, and the [configuration] table cannot repeat them', () => {
    const { configuration } = parseConfigurationManifest('example', { kind: 'tool' });
    expect([configuration.name, configuration.kind]).toStrictEqual(['example', 'tool']);
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'tool',
            tables: 'name = "example"\n',
        }),
    ).toThrow('its folder already gives');
});

test('a template pointer rejects a conflicting emission mode', () => {
    const source = `[[tool_file]]\nsource = "config.eta"\ntarget = ".gspot/config.toml"\npointer = { path = "config.toml", template = "editor.eta" }\n`;
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'general',
            tables: source.replace('template = "editor.eta"', 'template = "editor.eta", copy = true'),
        }),
    ).toThrow('tool_file.0.pointer: Unrecognized key: "copy"');
    expect(() => parseConfigurationManifest('example', { kind: 'general', tables: source })).not.toThrow();
});

test('query-pack metadata refuses a version range and accepts an exact release', () => {
    expect(() =>
        parseConfigurationManifest('security', {
            kind: 'general',
            tables: `${SECURITY_DECLARATION}query_packs = {python = "^1.2.3"}\n`,
        }),
    ).toThrow('tool.0.query_packs.python');
    expect(
        parseConfigurationManifest('security', {
            kind: 'general',
            tables: `${SECURITY_DECLARATION}query_packs = {python = "1.7.8"}\n`,
        }).tools[0]!.query_packs,
    ).toStrictEqual({ python: '1.7.8' });
});

test('a tool names its rule page with the rule placeholder and its crash pattern as a regular expression', () => {
    const manifest = parseConfigurationManifest('example', {
        kind: 'tool',
        tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\ncrash_pattern = '^Fatal:'\n`,
    });
    expect(manifest.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'tool',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
        }),
    ).toThrow('{rule}');
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'tool',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\ncrash_pattern = '(Fatal'\n`,
        }),
    ).toThrow('regular expression');
});

test('tool suppression metadata validates an inline pattern without requiring it', () => {
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'language',
            tables: SUPPRESSION_DECLARATION.replace(' }', ', inline_marker = "(" }'),
        }),
    ).toThrow('regular expression');
    const manifest = parseConfigurationManifest('example', {
        kind: 'language',
        tables: SUPPRESSION_DECLARATION.replace(' }', ', inline_marker = "# line-disable" }'),
    });
    expect(manifest.tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        inline_marker: '# line-disable',
        reason: 'reason: (?<reason>.+)',
    });
    expect(
        parseConfigurationManifest('example', { tables: SUPPRESSION_DECLARATION }).tools[0]?.suppression,
    ).toStrictEqual({
        marker: '# file-disable',
        reason: 'reason: (?<reason>.+)',
    });
});

test('tool failure headers validate their pattern and survive manifest parsing', () => {
    const text = `${TOOL_DECLARATION}diagnostic_header_pattern = '^Banner:'\n`;
    expect(
        parseConfigurationManifest('example', { kind: 'tool', tables: text }).tools[0]?.diagnostic_header_pattern,
    ).toBe('^Banner:');
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'tool',
            tables: `${TOOL_DECLARATION}diagnostic_header_pattern = '('\n`,
        }),
    ).toThrow('regular expression');
});

test('companion tools refuse a configuration with no consuming tool or check', () => {
    expect(() =>
        parseConfigurationManifest('consumer', {
            kind: 'tool',
            tables: '[[tool_file]]\ntarget = ".gspot/config/example.json"\nfragment = true\nrequired_tools = ["example"]\n',
        }),
    ).toThrow('Companion tools require a consuming tool or check.');
});

test('syntax selector coverage has no separate level declaration and retains its file and allowance fields', () => {
    for (const level of ['recommended', 'all'])
        expect(() =>
            parseConfigurationManifest('example', {
                tables: SYNTAX_SELECTOR_DECLARATION.replace(' }]', `, level = "${level}" }]`),
            }),
        ).toThrow('tool_file.0.selectors.0: Unrecognized key: "level"');
    expect(
        parseConfigurationManifest('example', { tables: SYNTAX_SELECTOR_DECLARATION }).toolFiles[0]?.selectors,
    ).toStrictEqual([
        {
            selector: "CallExpression[callee.name='query']",
            message: 'Use the declared query contract.',
            files: ['**/*.ts'],
            allowed: 'drizzle.raw_sql_allowed',
        },
    ]);
});

test('Semgrep packs infer their scoped security declaration while explicit unrelated targets stay authored', () => {
    using _assets = spyOn(assets, 'listAssets').mockReturnValue(SEMGREP_ASSETS);
    const manifest = parseConfigurationManifest('example', {
        tables: '[[tool_file]]\nsource = "other.eta"\ntarget = ".gspot/config/other.yml"\npointer = { path = "other.yml" }\n',
    });
    expect(manifest.toolFiles.map(({ source, target }) => [source, target])).toStrictEqual([
        ['other.eta', '.gspot/config/other.yml'],
        ['semgrep/first.yml.eta', '.gspot/config/semgrep/first.yml'],
        ['semgrep/second.yml.eta', '.gspot/config/semgrep/second.yml'],
    ]);
    expect(manifest.toolFiles.slice(1)).toMatchObject([
        { tool: ['semgrep'], rule_keys: ['rules'], per_scope: true, when: { configuration: 'security' } },
        { tool: ['semgrep'], rule_keys: ['rules'], per_scope: true, when: { configuration: 'security' } },
    ]);
    expect(() => parseConfigurationManifest('example', { tables: 'tool_file = "invalid"\n' })).toThrow('tool_file');
});

test('every shipped setting declares a default', () => {
    expect(
        [...configurationManifests().values()].flatMap((manifest) =>
            manifest.settings.filter((setting) => setting.default === undefined).map((setting) => setting.name),
        ),
    ).toStrictEqual([]);
});
