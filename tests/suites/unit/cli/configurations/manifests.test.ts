import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { buildConfiguration } from '#tests/setup/cli/configurations.ts';
import { manifestToolSchema } from '#cli/schemas/configurations/tool.ts';

import {
    SEMGREP_ASSETS,
    VALID_SCAN_CHECK,
    SINGLE_CONFIG_FILES,
    CONFIGURATION_TABLE,
    EXAMPLE_MANIFEST_PATH,
    MINIMUM_VERSION_CASES,
    MANIFEST_INVARIANT_CASES,
    SEMGREP_CONFIG_FILE_PATHS,
    SEMGREP_CONFIG_FILE_TABLES,
} from '#tests/config/configurations/manifests.ts';

async function readTestManifests(
    files: Record<string, string>,
    assets: readonly string[] = [],
): Promise<Map<string, Configuration>> {
    const result = await runCommand(buildProgramCommand('processes/manifests', JSON.stringify({ files, assets })), {
        cwd: process.cwd(),
    });
    if (result.code !== 0) throw new Error(result.stderr.trim());
    return new Map(JSON.parse(result.stdout) as [string, Configuration][]);
}

test('a manifest without [detect] takes the matchers of [files]', () => {
    const tables = '[files]\nfilenames = ["native.project"]\npaths = ["source/**"]\n';
    const inherited = buildConfiguration('native', { tables });
    expect(inherited.detect.filenames).toStrictEqual(['native.project']);
    expect(inherited.detect.paths).toStrictEqual(['source/**']);
    const explicit = buildConfiguration('native', {
        tables: '[detect]\nfilenames = ["explicit.project"]\n' + tables,
    });
    expect(explicit.detect.filenames).toStrictEqual(['explicit.project']);
    expect(explicit.detect.paths).toStrictEqual([]);
    const empty = buildConfiguration('native', { tables: '[detect]\n' + tables });
    expect(empty.detect.filenames).toStrictEqual([]);
    expect(empty.detect.paths).toStrictEqual([]);
});

test.each([...MINIMUM_VERSION_CASES])('a minimum version $minimum becomes $expected', ({ minimum, expected }) => {
    const parsed = manifestToolSchema.safeParse({ name: 'example', version: '4.4.0', min_version: minimum });
    expect(parsed.success && typeof parsed.data !== 'string' ? parsed.data.min_version : undefined).toBe(expected);
});

test('an npm package name becomes the npm installer pin', () => {
    const tool = manifestToolSchema.parse({ name: 'probe', version: '1.0.0', npm: 'native-probe' });
    expect(tool).toMatchObject({
        name: 'probe',
        kind: 'program',
        installers: { npm: { name: 'native-probe', version: '1.0.0' } },
    });
});

test.each([
    { order: 'owner first', ownerFirst: true },
    { order: 'consumer first', ownerFirst: false },
])('a tool name links to the configuration that declares it, listed $order', async ({ ownerFirst }) => {
    const consumer = 'configurations/infrastructure/consumer/manifest.toml';
    const owner = 'configurations/general/owner/manifest.toml';
    const consumed = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n';
    const manifest = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nsystem = true\n';
    const paths = ownerFirst ? [owner, consumer] : [consumer, owner];
    const files = Object.fromEntries(paths.map((path) => [path, path === consumer ? consumed : manifest]));
    const configurations = await readTestManifests(files);
    expect(configurations.get('consumer')!.tools).toStrictEqual(configurations.get('owner')!.tools);
});

test('a config file that names no tool and no check goes to the only tool of its configuration', async () => {
    const configurations = await readTestManifests(
        { [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + SINGLE_CONFIG_FILES + VALID_SCAN_CHECK },
        SEMGREP_ASSETS,
    );
    const configuration = configurations.get('example')!;

    expect(configuration.configFiles.map(({ target, tool, check }) => [target, tool, check])).toStrictEqual([
        [`${GSPOT_PATHS.configurations}/language/example/semgrep/first.yml`, ['semgrep'], []],
        [`${GSPOT_PATHS.configurations}/language/example/semgrep/second.yml`, [], ['example/scan']],
    ]);
});

test('only declared config files are loaded and each record sets its tool and scope', async () => {
    const configurations = await readTestManifests(
        {
            [EXAMPLE_MANIFEST_PATH]:
                CONFIGURATION_TABLE + SEMGREP_CONFIG_FILE_TABLES + '[[tool]]\nname = "semgrep"\nversion = "1.0.0"\n',
        },
        SEMGREP_ASSETS,
    );
    const configuration = configurations.get('example')!;
    expect(configuration.configFiles.map(({ source, target }) => [source, target])).toStrictEqual([
        ...SEMGREP_CONFIG_FILE_PATHS,
    ]);
    expect(configuration.configFiles.slice(1, 3)).toMatchObject([
        { tool: ['semgrep'], per_scope: true },
        { tool: ['semgrep'], per_scope: true },
    ]);
});

test.each([...MANIFEST_INVARIANT_CASES])(
    'the loader refuses $name with the owning configuration',
    async ({ tables, message }) => {
        const error = await captureRejection(
            readTestManifests({ [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + tables }),
        );
        expect(error.message).toBe(`The configuration manifest for \`example\` is not valid:\n${message}`);
    },
);

test.each(['example-names.json', 'eslint-presets.json'])('the loader refuses a stale %s snapshot', async (name) => {
    const path = `configurations/language/example/${name}`;
    const snapshot = { package: 'probe', version: '2.0.0', names: [] };
    const preset = {
        package: 'probe',
        version: '2.0.0',
        source: 'configs.recommended',
        blocks: [{ parser: false, rules: {} }],
    };
    const files = {
        [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nnpm = "probe"\nversion = "1.0.0"\n',
        [path]: JSON.stringify(name.endsWith('-names.json') ? snapshot : { recommended: preset }),
    };
    const versionError = await captureRejection(readTestManifests(files, [path]));
    expect(versionError.message).toBe(
        'The configuration manifest for `example` is not valid:\nprobe snapshot version 2.0.0 does not match its npm pin.',
    );
});

test('a mise installer with options inherits its tool record version', () => {
    expect(
        manifestToolSchema.parse({
            name: 'probe',
            version: '1.0.0',
            mise: { name: 'github:org/probe', options: { rename_exe: 'probe' } },
        }),
    ).toMatchObject({
        installers: { mise: { name: 'github:org/probe', version: '1.0.0', options: { rename_exe: 'probe' } } },
    });
});
