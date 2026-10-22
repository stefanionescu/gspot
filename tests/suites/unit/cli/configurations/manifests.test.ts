import type { ZodError } from 'zod';
import { test, expect } from 'bun:test';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { buildConfiguration } from '#tests/setup/cli/configurations.ts';
import { manifestToolSchema } from '#cli/schemas/configurations/tool.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';

import {
    TOOL_TABLE,
    SEMGREP_ASSETS,
    REPLACE_KEY_TABLE,
    REPLACEMENT_TABLES,
    SINGLE_CONFIG_FILES,
    CONFIGURATION_TABLE,
    TOOL_TABLE_REFUSALS,
    EXAMPLE_MANIFEST_PATH,
    MINIMUM_VERSION_CASES,
    MANIFEST_READER_SCRIPT,
    SEMGREP_CONFIG_FILE_PATHS,
    SEMGREP_CONFIG_FILE_TABLES,
} from '#tests/config/configurations/manifests.ts';

/** Read fixture package data in its own process, retaining the production module cache. */
async function readTestManifests(
    files: Record<string, string>,
    assets: readonly string[] = [],
): Promise<Map<string, Configuration>> {
    const result = await runCommand(
        [process.execPath, '--eval', MANIFEST_READER_SCRIPT, JSON.stringify({ files, assets })],
        { cwd: process.cwd() },
    );
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

test.each([...MINIMUM_VERSION_CASES])(
    'a minimum version $minimum becomes $expected, and a word is refused',
    ({ minimum, expected }) => {
        const parsed = manifestToolSchema.safeParse({ name: 'example', version: '4.4.0', min_version: minimum });
        expect(parsed.success && typeof parsed.data !== 'string' ? parsed.data.min_version : undefined).toBe(expected);
    },
);

test('a replace_key record refuses both a key and a table', () => {
    expect(() =>
        buildConfiguration('example', { tables: REPLACE_KEY_TABLE + 'key = "eslintConfig"\ntable = "tool.ruff"\n' }),
    ).toThrow(matchFields<ZodError>({ issues: [matchFields<ZodError['issues'][number]>({ path: ['tool', 0] })] }));
});

test('a replacement list keeps owned files and shared sections', () => {
    const declaration = buildConfiguration('native', { tables: REPLACEMENT_TABLES }).tools[0]!;
    expect(declaration).toMatchObject({
        replace: ['.native', 'native.json'],
        replace_key: [{ file: 'package.json', key: 'native' }],
    });
});

test.each([...TOOL_TABLE_REFUSALS])(
    'a manifest [[tool]] table refuses $name at its field',
    ({ tables, path, message }) => {
        expect(() => buildConfiguration('native', { group: 'infrastructure', tables })).toThrow(
            matchFields<ZodError>({
                issues: [
                    expect.objectContaining({
                        path: ['tool', 0],
                        errors: [expect.anything(), [expect.objectContaining({ path: [...path], message })]],
                    }) as ZodError['issues'][number],
                ],
            }),
        );
    },
);

test('a manifest [[tool]] table refuses a bare name and unknown fields, and turns an npm package name into an installer pin', () => {
    expect(manifestToolSchema.safeParse('probe').success).toBe(false);
    expect(manifestToolSchema.safeParse({ name: 'probe', mystery: true }).success).toBe(false);
    const tool = manifestToolSchema.parse({ name: 'probe', version: '1.0.0', npm: 'native-probe' });
    expect(tool).toMatchObject({
        name: 'probe',
        kind: 'program',
        installers: { npm: { name: 'native-probe', version: '1.0.0' } },
    });
});

test('a tool declared by two configurations is refused', async () => {
    const paths = ['configurations/general/owner/manifest.toml', 'configurations/general/second/manifest.toml'];
    const files = Object.fromEntries(
        paths.map((path) => [
            path,
            CONFIGURATION_TABLE +
                `[[tool]]\nname = "probe"\nversion = "${path.includes('/owner/') ? '1.0.0' : '2.0.0'}"\n`,
        ]),
    );
    expect(await captureRejection(readTestManifests(files))).toBe(
        'The configuration manifest for `second` is not valid:\ntool probe is already declared.',
    );
});

test('a tool that no configuration declares fails', async () => {
    const consumer = 'configurations/infrastructure/consumer/manifest.toml';
    const consumed = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n';
    expect(await captureRejection(readTestManifests({ [consumer]: consumed }))).toBe(
        'The configuration manifest for `consumer` is not valid:\ntool probe has no declaration.',
    );
});

test.each([
    { order: 'owner first', ownerFirst: true },
    { order: 'consumer first', ownerFirst: false },
])('a tool name links to the configuration that declares it, listed $order', async ({ ownerFirst }) => {
    expect(manifestToolSchema.parse({ name: 'probe' })).toBe('probe');
    const consumer = 'configurations/infrastructure/consumer/manifest.toml';
    const owner = 'configurations/general/owner/manifest.toml';
    const consumed = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n';
    const declared = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nsystem = true\n';
    const paths = ownerFirst ? [owner, consumer] : [consumer, owner];
    const files = Object.fromEntries(paths.map((path) => [path, path === consumer ? consumed : declared]));
    const configurations = await readTestManifests(files);
    expect(configurations.get('consumer')!.tools).toStrictEqual(configurations.get('owner')!.tools);
});

test('a manifest [[tool]] table keeps a rule page with {rule}, a rule prefix, and a crash pattern', () => {
    const configuration = buildConfiguration('example', {
        group: 'infrastructure',
        tables: `${TOOL_TABLE}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '^Fatal:'\n`,
    });
    expect(configuration.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        rule_prefix: '@example/plugin',
        crash_pattern: '^Fatal:',
    });
});

test('a config file that names no tool and no check goes to the only tool of its configuration', async () => {
    const configurations = await readTestManifests(
        { [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + SINGLE_CONFIG_FILES },
        SEMGREP_ASSETS,
    );
    const configuration = configurations.get('example')!;

    expect(configuration.configFiles.map(({ target, tool, check }) => [target, tool, check])).toStrictEqual([
        ['.gspot/configurations/language/example/semgrep/first.yml', ['semgrep'], []],
        ['.gspot/configurations/language/example/semgrep/second.yml', [], ['example/scan']],
        ['.gspot/configurations/language/example/semgrep/not-a-pack.txt', ['semgrep'], []],
    ]);
});

test('the files under config-files/ become config files, each [[config_file]] sets its tool and condition, and a config_file that is not a table is refused', async () => {
    const configurations = await readTestManifests(
        { [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + SEMGREP_CONFIG_FILE_TABLES },
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
    expect(() => buildConfiguration('example', { tables: 'config_file = "invalid"\n' })).toThrow(
        matchFields<ZodError>({
            issues: [
                matchFields<ZodError['issues'][number]>({
                    path: ['config_file'],
                    message: 'Invalid input: expected array, received string',
                }),
            ],
        }),
    );
});

test('a content detection pattern that is not a regular expression is refused', () => {
    expect(() =>
        buildConfiguration('content', {
            group: 'database',
            tables: '[detect.content]\n"prisma/schema.prisma" = "["\n',
        }),
    ).toThrow(
        matchFields<ZodError>({
            issues: [
                matchFields<ZodError['issues'][number]>({
                    path: ['detect', 'content', 'prisma/schema.prisma'],
                    message: 'Use a valid Unicode regular expression.',
                }),
            ],
        }),
    );
});
