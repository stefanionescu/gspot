import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { knownSettings } from '#cli/settings/view.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { declarationFor } from '#cli/settings/inherit.ts';
import { TOOL_DECLARATION } from '#tests/config/manifests.ts';
import { settingSchema } from '#cli/settings/schema/gspot-toml.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';
import { SEMGREP_ASSETS, CONFIGURATION_TABLE } from '#tests/config/configurations.ts';
import { parseManifest, configurationManifests } from '#cli/configurations/manifests.ts';

test('setting names in shipped manifest text and rules exist', () => {
    const manifests = [...configurationManifests().values()];
    const known = knownSettings(manifests, 'all');
    const roots = new Set([...known.declarations.keys()].map((key) => key.split('.', 1)[0]));
    const sources = [
        ...manifests.flatMap(({ dir, checks }) =>
            checks.map((check) => ({
                path: `${dir}/manifest.toml`,
                text: [check.summary, check.example, check.why, check.help].join('\n'),
            })),
        ),
        ...assets
            .listAssets(CONFIGURATIONS_FOLDER)
            .filter((path) => path.includes('/rules/') && path.endsWith('.md'))
            .map((path) => ({ path, text: assets.readAsset(path) })),
    ];
    const missing = sources.flatMap(({ path, text }) => {
        const prose = text.replaceAll(/https?:\/\/[^\s)]+/gu, '');
        return [...prose.matchAll(/(?<![\w/])[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\b/gu)]
            .map(([key]) => key)
            .filter(
                (key) =>
                    roots.has(key.split('.', 1)[0]) &&
                    declarationFor(known, key) === undefined &&
                    settingSchema(key) === undefined,
            )
            .map((key) => `${path}: ${key}`);
    });
    expect([...new Set(missing)]).toStrictEqual([]);
});

test('a tool declared by two configurations is refused', () => {
    const paths = ['configurations/general/owner/manifest.toml', 'configurations/general/second/manifest.toml'];
    using resources = new DisposableStack();
    resources.use(
        spyOn(assets, 'listAssets').mockImplementation((prefix) => (prefix === 'configurations/' ? paths : [])),
    );
    resources.use(
        spyOn(assets, 'readAsset').mockImplementation((path) => {
            if (path.endsWith('.json')) return '{}';
            const version = path.includes('/owner/') ? '1.0.0' : '2.0.0';
            return CONFIGURATION_TABLE + `[[tool]]\nname = "probe"\nversion = "${version}"\n`;
        }),
    );
    expect(() => configurationManifests()).toThrow('tool probe is already declared.');
});

test('a tool named without a declaration links to the configuration that declares it, and fails when none does', () => {
    expect(toolDeclarationSchema.parse({ name: 'probe' })).toBe('probe');
    const consumer = 'configurations/infrastructure/consumer/manifest.toml';
    const owner = 'configurations/general/owner/manifest.toml';
    using listing = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
        prefix === 'configurations/' ? [consumer] : [],
    );
    using resources = new DisposableStack();
    resources.use(
        spyOn(assets, 'readAsset').mockImplementation((path) => {
            if (path.endsWith('.json')) return '{}';
            return (
                CONFIGURATION_TABLE +
                (path === consumer ? '[[tool]]\nname = "probe"\n' : '[[tool]]\nname = "probe"\nsystem = true\n')
            );
        }),
    );
    expect(() => configurationManifests()).toThrow('tool probe has no declaration.');
    for (const paths of [
        [consumer, owner],
        [owner, consumer],
    ]) {
        listing.mockImplementation((prefix) => (prefix === 'configurations/' ? paths : []));
        const manifests = configurationManifests();
        expect(manifests.get('consumer')!.tools).toStrictEqual(manifests.get('owner')!.tools);
    }
});

test('the folder gives a configuration its name and group', () => {
    const { configuration } = buildManifest('example', { group: 'infrastructure' });
    expect([configuration.name, configuration.group]).toStrictEqual(['example', 'infrastructure']);
    expect(buildManifest('example', { group: 'testing' }).configuration.group).toBe('testing');
    expect(() =>
        parseManifest(
            '[configuration]\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n',
            'configurations/tool/example',
        ),
    ).toThrow('configuration.group');
});

test('a tool rule page needs the {rule} placeholder, and its crash pattern must be a regular expression', () => {
    const manifest = buildManifest('example', {
        group: 'infrastructure',
        tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '^Fatal:'\n`,
    });
    expect(manifest.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        rule_prefix: '@example/plugin',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        buildManifest('example', {
            group: 'infrastructure',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
        }),
    ).toThrow('{rule}');
    expect(() =>
        buildManifest('example', {
            group: 'infrastructure',
            tables: `${TOOL_DECLARATION}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '(Fatal'\n`,
        }),
    ).toThrow('regular expression');
});

test('a companion tool file needs a tool or check that reads it', () => {
    expect(() =>
        buildManifest('consumer', {
            group: 'infrastructure',
            tables: '[[tool_file]]\ntarget = ".gspot/config/example.json"\nfragment = true\nrequired_tools = ["example"]\n',
        }),
    ).toThrow('Companion tools require a consuming tool or check.');
});

test('Semgrep rule packs in the configuration folder become tool files read by the security configuration', () => {
    using _assets = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
        SEMGREP_ASSETS.filter((path) => path.startsWith(prefix)),
    );
    const manifest = buildManifest('example', {
        tables: '[[tool_file]]\nsource = "other.yml"\ntarget = ".gspot/config/other.yml"\npointer = { path = "other.yml" }\n',
    });
    expect(manifest.toolFiles.map(({ source, target }) => [source, target])).toStrictEqual([
        ['other.yml', '.gspot/config/other.yml'],
        ['semgrep/first.yml', '.gspot/config/semgrep/first.yml'],
        ['semgrep/second.yml', '.gspot/config/semgrep/second.yml'],
    ]);
    expect(manifest.toolFiles.slice(1)).toMatchObject([
        { tool: ['semgrep'], rule_keys: ['rules'], per_scope: true, when: { configuration: 'security' } },
        { tool: ['semgrep'], rule_keys: ['rules'], per_scope: true, when: { configuration: 'security' } },
    ]);
    expect(() => buildManifest('example', { tables: 'tool_file = "invalid"\n' })).toThrow('tool_file');
});
