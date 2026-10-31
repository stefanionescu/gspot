import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { manifestToolSchema } from '#cli/schemas/manifests/manifests.ts';

import {
    DECLARATION_ORDERS,
    CONFIGURATION_TABLE,
    EXAMPLE_MANIFEST_PATH,
    MINIMUM_VERSION_CASES,
    MANIFEST_INVARIANT_CASES,
} from '#tests/config/manifests.ts';

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

test.each(DECLARATION_ORDERS)(
    'a tool name links to the configuration that declares it, listed $order',
    async ({ ownerFirst }) => {
        const consumer = 'configurations/infrastructure/consumer/manifest.toml';
        const owner = 'configurations/general/owner/manifest.toml';
        const consumed = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n';
        const manifest = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nsystem = true\n';
        const paths = ownerFirst ? [owner, consumer] : [consumer, owner];
        const files = Object.fromEntries(paths.map((path) => [path, path === consumer ? consumed : manifest]));
        const configurationsByName = await readTestManifests(files);
        expect(configurationsByName.get('owner')!.tools).toStrictEqual([
            { name: 'probe', kind: 'program', system: true, installers: {} },
        ]);
        expect(configurationsByName.get('consumer')!.tools).toStrictEqual(configurationsByName.get('owner')!.tools);
    },
);

test('only declared config files are loaded and each record sets its tool and scope', async () => {
    const configurationsByName = await readTestManifests(
        {
            [EXAMPLE_MANIFEST_PATH]:
                CONFIGURATION_TABLE +
                '\n[[config_file]]\ntarget = "other.yml"\npointer = { path = "other.yml", body = "{target}" }\n\n[[config_file]]\ntarget = "semgrep/first.yml"\ntool = "semgrep"\nper_scope = true\n\n[[config_file]]\ntarget = "semgrep/second.yml"\ntool = "semgrep"\nper_scope = true\n' +
                '[[tool]]\nname = "semgrep"\nversion = "1.0.0"\n',
        },
        [
            'configurations/language/example/config/semgrep/first.yml',
            'configurations/language/example/config/semgrep/second.yml',
            'configurations/language/example/config/semgrep/not-a-pack.txt',
        ] as const,
    );
    const configuration = configurationsByName.get('example')!;
    expect(configuration.configs.map(({ source, target }) => [source, target])).toStrictEqual([
        ['config/other.yml', `${GSPOT_PATHS.configurations}/language/example/other.yml`],
        ['config/semgrep/first.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/first.yml`],
        ['config/semgrep/second.yml', `${GSPOT_PATHS.configurations}/language/example/semgrep/second.yml`],
    ]);
    expect(configuration.configs.slice(1, 3)).toMatchObject([
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
        expect(error.message).toBe(`The configuration manifest for example is not valid:\n${message}`);
    },
);

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

test('a reference to an undeclared tool names the configuration and missing declaration', async () => {
    const error = await captureRejection(
        readTestManifests({ [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + '[[tool]]\nname = "absent"\n' }),
    );
    expect(error.message).toBe('The configuration manifest for example is not valid:\ntool absent has no declaration.');
});
