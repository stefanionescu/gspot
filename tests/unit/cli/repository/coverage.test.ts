import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { buildTrackedFile } from '#tests/setup/builders.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildFileMatcher, listCoveredFiles } from '#cli/repository/covered-files.ts';
import { DECLARATION_FILES, GENERATED_SELECTIONS } from '#tests/data/repository/file-classification.ts';
import { JEST_CASES, JEST_PATHS, MIGRATION_CASES, MIGRATION_PATHS } from '#tests/data/configurations/detection.ts';

test('files are covered by extension, file name at any depth, tag and glob', () => {
    const configurations = readConfigurations();

    const bash = configurations.get('bash')!;
    expect(buildFileMatcher(bash.files)(buildTrackedFile('scripts/build.sh'))).toBe(true);
    expect(buildFileMatcher(bash.files)(buildTrackedFile('.gspot/hooks/pre-commit', ['text', 'shebang:shell']))).toBe(
        true,
    );
    expect(buildFileMatcher(bash.files)(buildTrackedFile('README.md'))).toBe(false);
    const filenames = { ...bash.files, extensions: [], filenames: ['_headers'], tags: [] };
    expect(buildFileMatcher(filenames)(buildTrackedFile('public/_headers'))).toBe(true);
    const paths = { ...bash.files, extensions: [], tags: [], paths: ['infra/**'] };
    expect(buildFileMatcher(paths)(buildTrackedFile('infra/config.txt'))).toBe(true);
    expect(buildFileMatcher(paths)(buildTrackedFile('docs/config.txt'))).toBe(false);
});

test('a configuration that covers the language files gets them', () => {
    const configurations = readConfigurations();

    const selected = selectConfigurations(['bash'], configurations);
    const structure = configurations.get('structure')!;
    const owned = listCoveredFiles(structure.files, [buildTrackedFile('a.sh'), buildTrackedFile('README.md')], {
        selected,
        scope: '',
        view: { test_files: [], settings: {} },
    });
    expect(owned.map((entry) => entry.path)).toStrictEqual(['a.sh']);
});

test.each([
    [['format', 'typescript'], ['src/index.ts']],
    [
        ['format', 'typescript', 'astro'],
        ['src/Page.astro', 'src/index.ts'],
    ],
    [
        ['format', 'typescript', 'svelte'],
        ['src/App.svelte', 'src/index.ts'],
    ],
])('the Prettier plugin files follow the selected configurations %j', (configurationNames, expected) => {
    const configurations = readConfigurations();

    const files = [
        buildTrackedFile('src/Page.astro'),
        buildTrackedFile('src/App.svelte'),
        buildTrackedFile('src/index.ts'),
    ];
    expect(
        listCoveredFiles(configurations.get('format')!.files, files, {
            selected: selectConfigurations(configurationNames, configurations),
            scope: '',
            view: { test_files: [], settings: {} },
        }).map((entry) => entry.path),
    ).toStrictEqual([...expected]);
});

test.each(MIGRATION_CASES)(
    'migration paths in scope "%s" are covered and other file kinds are not',
    (scope, expected) => {
        const configurations = readConfigurations();

        const selected = selectConfigurations(['postgres'], configurations);
        const files = MIGRATION_PATHS.map((path) => buildTrackedFile(path));
        const table = configurations.get('postgres')!.files;
        const options = { selected, scope, view: { test_files: [], settings: {} } };
        const owned = listCoveredFiles(table, files, options);
        expect(owned.map((file) => file.path)).toStrictEqual([...expected]);
        expect(listCoveredFiles({ ...table, kinds: ['binary'] }, files, options)).toStrictEqual([]);
        expect(listCoveredFiles({ ...table, paths: [] }, files, options)).toStrictEqual([]);
        expect(files.map((file) => file.path)).toStrictEqual([...MIGRATION_PATHS]);
    },
);

test.each([...JEST_CASES])('Jest covers the test paths of scope "$scope"', ({ scope, tests, expected }) => {
    const configurations = readConfigurations();

    const selected = selectConfigurations(['jest'], configurations);
    const files = JEST_PATHS.map((path) => buildTrackedFile(path));
    const owned = listCoveredFiles(configurations.get('jest')!.files, files, {
        selected,
        scope,
        view: { test_files: [...tests], settings: {} },
    });
    expect(owned.map(({ path }) => path)).toStrictEqual([...expected]);
    expect(files.map(({ path }) => path)).toStrictEqual([...JEST_PATHS]);
});

test.each([...GENERATED_SELECTIONS])(
    'the configurations each scope selects mark their generated files: $configurations $tables',
    async ({ configurations, tables, generated }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(configurations, { tables }),
            ...DECLARATION_FILES,
        });
        const session = await openSession(sandbox.path);
        const classified = session.repository.files.filter(({ path }) => path.endsWith('.d.ts'));
        expect(
            classified
                .filter(({ kind }) => kind === 'generated')
                .map(({ path }) => path)
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(generated.toSorted((left, right) => left.localeCompare(right)));
        expect(
            classified.filter(({ path }) => path.endsWith('handwritten.d.ts')).map(({ kind }) => kind),
        ).toStrictEqual(['source', 'source']);
    },
);

test('path selectors: ** crosses folders and ! negates', () => {
    const matcher = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
    expect(matcher('scripts/a/b.sh')).toBe(true);
    expect(matcher('scripts/vendor/x.sh')).toBe(false);
    expect(matcher('scripts/line\nbreak.sh')).toBe(true);
    expect(matcher('scripts/vendor/line\nbreak.sh')).toBe(false);
});
