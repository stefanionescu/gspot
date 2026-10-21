import type { ZodError } from 'zod';
import { test, expect } from 'bun:test';
import { runCommand } from '#tests/setup/processes.ts';
import { buildConfiguration } from '#tests/setup/builders.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { manifestToolSchema } from '#cli/schemas/configurations/tool.ts';

import {
    TOOL_TABLE,
    SEMGREP_ASSETS,
    VERSION_FLOORS,
    SINGLE_TOOL_FILES,
    REPLACE_KEY_TABLE,
    SEMGREP_TOOL_FILES,
    CONFIGURATION_TABLE,
    EXAMPLE_MANIFEST_PATH,
    MANIFEST_READER_SCRIPT,
} from '#tests/data/configurations/manifests.ts';

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

test.each([...VERSION_FLOORS])(
    'a minimum version $floor becomes $expected, and a word is refused',
    ({ floor, expected }) => {
        const parsed = manifestToolSchema.safeParse({ name: 'example', version: '4.4.0', min_version: floor });
        expect(parsed.success && typeof parsed.data !== 'string' ? parsed.data.min_version : undefined).toBe(expected);
    },
);

test('a replace_key record refuses both a key and a table', () => {
    expect(() =>
        buildConfiguration('example', { tables: REPLACE_KEY_TABLE + 'key = "eslintConfig"\ntable = "tool.ruff"\n' }),
    ).toThrow(matchFields<ZodError>({ issues: [matchFields<ZodError['issues'][number]>({ path: ['tool', 0] })] }));
});

test.each(['".native"', '[""]', '[7]'])(
    'replacement lists keep owned files and shared sections and refuse invalid items (%j)',
    (invalid) => {
        const tables =
            '[[tool]]\nname = "native"\nversion = "1.0.0"\nreplace = [".native", "native.json"]\n[[tool.replace_key]]\nfile = "package.json"\nkey = "native"\n';
        const declaration = buildConfiguration('native', { tables }).tools[0]!;
        if (typeof declaration === 'string') throw new Error('The fixture must declare native.');
        expect(declaration.replace).toStrictEqual(['.native', 'native.json']);
        expect(declaration.replace_key).toStrictEqual([{ file: 'package.json', key: 'native' }]);

        expect(() =>
            buildConfiguration('native', { tables: tables.replace('[".native", "native.json"]', invalid) }),
        ).toThrow('replace');
    },
);

test('a tool declaration refuses unknown fields', () => {
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
    const error = await readTestManifests(files).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: matchSubstring('tool probe is already declared.') });
});

test.each([false, true])(
    'a tool named without a declaration links to the configuration that declares it, and fails when none does (%j)',
    async (ownerFirst) => {
        expect(manifestToolSchema.parse({ name: 'probe' })).toBe('probe');
        const consumer = 'configurations/infrastructure/consumer/manifest.toml';
        const owner = 'configurations/general/owner/manifest.toml';
        const consumed = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\n';
        const declared = CONFIGURATION_TABLE + '[[tool]]\nname = "probe"\nsystem = true\n';
        const error = await readTestManifests({ [consumer]: consumed }).catch((error: unknown) => error);
        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({ message: matchSubstring('tool probe has no declaration.') });
        const paths = ownerFirst ? [owner, consumer] : [consumer, owner];
        const files = Object.fromEntries(paths.map((path) => [path, path === consumer ? consumed : declared]));
        const configurations = await readTestManifests(files);
        expect(configurations.get('consumer')!.tools).toStrictEqual(configurations.get('owner')!.tools);
    },
);

test('a tool rule page needs the {rule} placeholder, and its crash pattern must be a regular expression', () => {
    const configuration = buildConfiguration('example', {
        group: 'infrastructure',
        tables: `${TOOL_TABLE}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '^Fatal:'\n`,
    });
    expect(configuration.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        rule_prefix: '@example/plugin',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        buildConfiguration('example', {
            group: 'infrastructure',
            tables: `${TOOL_TABLE}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
        }),
    ).toThrow('{rule}');
    expect(() =>
        buildConfiguration('example', {
            group: 'infrastructure',
            tables: `${TOOL_TABLE}rule_url = "https://example.test/rules/{rule}"\nrule_prefix = "@example/plugin"\ncrash_pattern = '(Fatal'\n`,
        }),
    ).toThrow('regular expression');
});

test('the only tool of a configuration reads each of its tool files that names no consumer', async () => {
    const configurations = await readTestManifests(
        { [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + SINGLE_TOOL_FILES },
        SEMGREP_ASSETS,
    );
    const configuration = configurations.get('example')!;

    expect(configuration.toolFiles.map(({ target, tool, check }) => [target, tool, check])).toStrictEqual([
        ['.gspot/configurations/language/example/semgrep/first.yml', ['semgrep'], []],
        ['.gspot/configurations/language/example/semgrep/second.yml', [], ['example/scan']],
        ['.gspot/configurations/language/example/semgrep/not-a-pack.txt', ['semgrep'], []],
    ]);
});

test('tool-files assets are discovered and their metadata selects their consumers', async () => {
    const configurations = await readTestManifests(
        { [EXAMPLE_MANIFEST_PATH]: CONFIGURATION_TABLE + SEMGREP_TOOL_FILES },
        SEMGREP_ASSETS,
    );
    const configuration = configurations.get('example')!;
    expect(configuration.toolFiles.map(({ source, target }) => [source, target])).toStrictEqual([
        ['tool-files/other.yml', '.gspot/configurations/language/example/other.yml'],
        ['tool-files/semgrep/first.yml', '.gspot/configurations/language/example/semgrep/first.yml'],
        ['tool-files/semgrep/second.yml', '.gspot/configurations/language/example/semgrep/second.yml'],
        ['tool-files/semgrep/not-a-pack.txt', '.gspot/configurations/language/example/semgrep/not-a-pack.txt'],
    ]);
    expect(configuration.toolFiles.slice(1, 3)).toMatchObject([
        { tool: ['semgrep'], per_scope: true },
        { tool: ['semgrep'], per_scope: true },
    ]);
    expect(() => buildConfiguration('example', { tables: 'tool_file = "invalid"\n' })).toThrow('tool_file');
});

test('each accepted suppression example matches its marker and gives a reason', () => {
    const forms = [...readConfigurations().values()].flatMap((configuration) =>
        configuration.tools.flatMap((tool) =>
            typeof tool === 'string' || tool.suppression === undefined || tool.suppression.forbidden === true
                ? []
                : [{ name: tool.name, ...tool.suppression }],
        ),
    );
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
        const example = form.example ?? '';
        const markers = [form.marker, form.inline_marker ?? form.marker].map((pattern) => new RegExp(pattern, 'u'));
        expect(
            markers.some((marker) => marker.test(example)),
            form.name,
        ).toBe(true);
        expect(
            new RegExp(form.reason, 'u').exec(example)?.groups?.['reason']?.split(' ').length,
            form.name,
        ).toBeGreaterThan(1);
    }
});
