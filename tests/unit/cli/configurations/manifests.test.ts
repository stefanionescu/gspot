import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { buildManifest } from '#tests/setup/builders.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { versionFloorSchema } from '#cli/configurations/schema/parts.ts';
import { toolDeclarationSchema } from '#cli/configurations/schema/tool.ts';

import {
    SEMGREP_ASSETS,
    TOOL_DECLARATION,
    SEMGREP_TOOL_FILES,
    CONFIGURATION_TABLE,
    REPLACE_DECLARATION,
    INVALID_VERSION_FLOORS,
} from '#tests/data/configurations/manifests.ts';

test('manifest > a manifest without [detect] takes the matchers of [files]', () => {
    const tables = '[files]\nfilenames = ["native.project"]\npaths = ["source/**"]\n';
    const inherited = buildManifest('native', { tables });
    expect(inherited.detect.filenames).toStrictEqual(['native.project']);
    expect(inherited.detect.paths).toStrictEqual(['source/**']);
    const explicit = buildManifest('native', {
        tables: '[detect]\nfilenames = ["explicit.project"]\n' + tables,
    });
    expect(explicit.detect.filenames).toStrictEqual(['explicit.project']);
    expect(explicit.detect.paths).toStrictEqual([]);
    const empty = buildManifest('native', { tables: '[detect]\n' + tables });
    expect(empty.detect.filenames).toStrictEqual([]);
    expect(empty.detect.paths).toStrictEqual([]);
});

test.each(INVALID_VERSION_FLOORS)('parts > a malformed version floor %s is refused', (floor) => {
    expect(versionFloorSchema.safeParse(floor).success).toBe(false);
});

test('tool > a replace_key record refuses both a key and a table', () => {
    expect(() =>
        buildManifest('example', { tables: REPLACE_DECLARATION + 'key = "eslintConfig"\ntable = "tool.ruff"\n' }),
    ).toThrow('A replace_key record selects one key or table.');
});

test.each(['".native"', '[""]', '[7]'])(
    'tool > replacement lists keep owned files and shared sections and refuse invalid items (%j)',
    (invalid) => {
        const tables =
            '[[tool]]\nname = "native"\nversion = "1.0.0"\nreplace = [".native", "native.json"]\n[[tool.replace_key]]\nfile = "package.json"\nkey = "native"\n';
        const declaration = buildManifest('native', { tables }).tools[0]!;
        if (typeof declaration === 'string') throw new Error('The fixture must declare native.');
        expect(declaration.replace).toStrictEqual(['.native', 'native.json']);
        expect(declaration.replace_key).toStrictEqual([{ file: 'package.json', key: 'native' }]);

        expect(() =>
            buildManifest('native', { tables: tables.replace('[".native", "native.json"]', invalid) }),
        ).toThrow('replace');
    },
);

test('tool > a tool declaration refuses unknown fields', () => {
    expect(toolDeclarationSchema.safeParse('probe').success).toBe(false);
    expect(toolDeclarationSchema.safeParse({ name: 'probe', mystery: true }).success).toBe(false);
    const tool = toolDeclarationSchema.parse({ name: 'probe', version: '1.0.0', npm: 'native-probe' });
    expect(tool).toMatchObject({
        name: 'probe',
        kind: 'program',
        installers: { npm: { name: 'native-probe', version: '1.0.0' } },
    });
});

test('manifests > a tool declared by two configurations is refused', () => {
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

test.each([false, true])(
    'manifests > a tool named without a declaration links to the configuration that declares it, and fails when none does (%j)',
    (ownerFirst) => {
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
        const paths = ownerFirst ? [owner, consumer] : [consumer, owner];

        listing.mockImplementation((prefix) => (prefix === 'configurations/' ? paths : []));
        const manifests = readManifests(createReadCache(process.cwd()));
        expect(manifests.get('consumer')!.tools).toStrictEqual(manifests.get('owner')!.tools);
    },
);

test('manifests > a tool rule page needs the {rule} placeholder, and its crash pattern must be a regular expression', () => {
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

test('manifests > a companion tool file needs a tool or check that reads it', () => {
    expect(() =>
        buildManifest('consumer', {
            group: 'infrastructure',
            tables: '[[tool_file]]\ntarget = ".gspot/config/example.json"\nfragment = true\nrequired_tools = ["example"]\n',
        }),
    ).toThrow('Companion tools require a consuming tool or check.');
});

test('manifests > tool-files assets are discovered and their metadata selects their consumers', () => {
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
