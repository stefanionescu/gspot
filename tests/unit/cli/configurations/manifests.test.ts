import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { findDeclaration } from '#cli/settings/inherit.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { TOOL_DECLARATION } from '#tests/config/manifests.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations.ts';
import { findSettingSchema } from '#cli/settings/schema/gspot-toml.ts';
import { manifestSchema } from '#cli/configurations/schema/manifest.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';
import { SEMGREP_ASSETS, SEMGREP_TOOL_FILES, CONFIGURATION_TABLE } from '#tests/config/configurations.ts';

test('setting names in shipped manifest text and rules exist', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const known = buildKnownSettings(manifests, 'all');
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
                    findDeclaration(known, key) === undefined &&
                    findSettingSchema(key) === undefined,
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
    expect(() => readManifests(createReadCache(process.cwd()))).toThrow('tool probe is already declared.');
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
    expect(() => readManifests(createReadCache(process.cwd()))).toThrow('tool probe has no declaration.');
    for (const paths of [
        [consumer, owner],
        [owner, consumer],
    ]) {
        listing.mockImplementation((prefix) => (prefix === 'configurations/' ? paths : []));
        const manifests = readManifests(createReadCache(process.cwd()));
        expect(manifests.get('consumer')!.tools).toStrictEqual(manifests.get('owner')!.tools);
    }
});

test('the folder gives a configuration its name and group', () => {
    const { configuration } = buildManifest('example', { group: 'infrastructure' });
    expect([configuration.name, configuration.group]).toStrictEqual(['example', 'infrastructure']);
    expect(buildManifest('example', { group: 'testing' }).configuration.group).toBe('testing');
    expect(() => manifestSchema.parse({ configuration: { ...configuration, group: 'tool' } })).toThrow('group');
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

test('tool-files assets are discovered and their metadata selects their consumers', () => {
    using _assets = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
        prefix === 'configurations/'
            ? ['configurations/language/example/manifest.toml']
            : SEMGREP_ASSETS.filter((path) => path.startsWith(prefix)),
    );
    const readAsset = assets.readAsset;
    using _sources = spyOn(assets, 'readAsset').mockImplementation((path) =>
        path === 'configurations/language/example/manifest.toml'
            ? CONFIGURATION_TABLE + SEMGREP_TOOL_FILES
            : readAsset(path),
    );
    const manifest = readManifests(createReadCache(process.cwd())).get('example')!;
    expect(manifest.toolFiles.map(({ source, target }) => [source, target])).toStrictEqual([
        ['tool-files/other.yml', '.gspot/config/other.yml'],
        ['tool-files/semgrep/first.yml', '.gspot/config/semgrep/first.yml'],
        ['tool-files/semgrep/second.yml', '.gspot/config/semgrep/second.yml'],
        ['tool-files/semgrep/not-a-pack.txt', '.gspot/config/semgrep/not-a-pack.txt'],
    ]);
    expect(manifest.toolFiles.slice(1, 3)).toMatchObject([
        { tool: ['semgrep'], per_scope: true, when: { configuration: 'security' } },
        { tool: ['semgrep'], per_scope: true, when: { configuration: 'security' } },
    ]);
    expect(() => buildManifest('example', { tables: 'tool_file = "invalid"\n' })).toThrow('tool_file');
});
