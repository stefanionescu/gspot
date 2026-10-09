import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/platform/root/public.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { CONFIGURATION_TABLE } from '#tests/config/samples/configurations.ts';
import { parseManifest, configurationManifests } from '#cli/configurations/public.ts';

import {
    SEMGREP_ASSETS,
    TOOL_DECLARATION,
    SECURITY_DECLARATION,
    IGNORED_PATH_REFUSALS,
    SUPPRESSION_DECLARATION,
    SYNTAX_SELECTOR_DECLARATION,
} from '#tests/config/cli/parsers/configurations.ts';

test('the folder gives a configuration its name and kind, and the [configuration] table cannot repeat them', () => {
    const { configuration } = parseConfigurationManifest('example', { kind: 'infra' });
    expect([configuration.name, configuration.kind]).toStrictEqual(['example', 'infra']);
    expect(parseConfigurationManifest('example', { kind: 'test' }).configuration.kind).toBe('test');
    expect(() =>
        parseManifest(
            '[configuration]\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n',
            'configurations/tool/example',
        ),
    ).toThrow('configuration.kind');
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'infra',
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
        kind: 'infra',
        tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '^Fatal:'\n`,
    });
    expect(manifest.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        rule_prefix: '@example/plugin',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'infra',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
        }),
    ).toThrow('{rule}');
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'infra',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '(Fatal'\n`,
        }),
    ).toThrow('regular expression');
});

test.each(['rule_prefix = ""', 'rule_prefix = 1'])('a tool refuses invalid prefix metadata %s', (prefix) => {
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'infra',
            tables: `${TOOL_DECLARATION}${prefix}\n`,
        }),
    ).toThrow('rule_prefix');
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
        parseConfigurationManifest('example', { kind: 'infra', tables: text }).tools[0]?.diagnostic_header_pattern,
    ).toBe('^Banner:');
    expect(() =>
        parseConfigurationManifest('example', {
            kind: 'infra',
            tables: `${TOOL_DECLARATION}diagnostic_header_pattern = '('\n`,
        }),
    ).toThrow('regular expression');
});

test('companion tools refuse a configuration with no consuming tool or check', () => {
    expect(() =>
        parseConfigurationManifest('consumer', {
            kind: 'infra',
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

test('settings omit neutral direction and retain only actual enforcement directions', () => {
    const source = '[[setting]]\nname = "example.path"\ntype = "string"\ndefault = ""\nsummary = "The project path."\n';
    expect(parseConfigurationManifest('example', { tables: source }).settings[0]).not.toHaveProperty('direction');
    for (const direction of ['ceiling', 'floor', 'loosening', 'tightening', 'rule-options'] as const)
        expect(
            parseConfigurationManifest('example', { tables: `${source}direction = "${direction}"\n` }).settings[0]
                ?.direction,
        ).toBe(direction);
    for (const direction of ['neutral', 'per-rule', 'unknown'])
        expect(() =>
            parseConfigurationManifest('example', { tables: `${source}direction = "${direction}"\n` }),
        ).toThrow('direction');
});

test('configuration product names validate once as native manifest words', () => {
    const source =
        'products = ["SwiftLint", "Swift"]\n[configuration]\ntitle = "Example"\ndescription = "A configuration for native product words."\n';
    expect(parseManifest(source, 'configurations/language/example').products).toStrictEqual(['SwiftLint', 'Swift']);
    expect(() =>
        parseManifest(source.replace('["SwiftLint", "Swift"]', '[1]'), 'configurations/language/example'),
    ).toThrow('products');
    expect(() =>
        parseManifest(source.replace('["SwiftLint", "Swift"]', '"Swift"'), 'configurations/language/example'),
    ).toThrow('products');
});

test.each(IGNORED_PATH_REFUSALS)('a manifest cannot hide authored paths through $path', ({ path, reason }) => {
    expect(() =>
        parseManifest(`ignored = [${JSON.stringify(path)}]\n` + CONFIGURATION_TABLE, 'configurations/general/local'),
    ).toThrow(reason);
});

test('a manifest can ignore its installation folder inside .gspot', () => {
    expect(() =>
        parseManifest('ignored = [".gspot/downloads/"]\n' + CONFIGURATION_TABLE, 'configurations/general/local'),
    ).not.toThrow();
});

test('native prefix collision facts validate once and have no policy allowance or disable field', () => {
    const directory = 'configurations/framework/example';
    expect(parseManifest(CONFIGURATION_TABLE, directory).prefix_collisions).toStrictEqual({ prefixes: [], kinds: [] });
    expect(
        parseManifest(
            `prefix_collisions = { prefixes = ["tool"], kinds = ["controller"] }\n${CONFIGURATION_TABLE}`,
            directory,
        ).prefix_collisions,
    ).toStrictEqual({ prefixes: ['tool'], kinds: ['controller'] });
    for (const invalid of ['prefixes = [1]', 'kinds = [false]', 'allow = true'])
        expect(() => parseManifest(`prefix_collisions = { ${invalid} }\n${CONFIGURATION_TABLE}`, directory)).toThrow(
            'prefix_collisions',
        );
});
