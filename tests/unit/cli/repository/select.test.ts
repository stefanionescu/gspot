import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildTrackedFile } from '#tests/setup/tracked-file.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { pathMatcher, filenameMatcher } from '#cli/repository/matchers.ts';
import { coveredBy, isCovered, selectForScope } from '#cli/repository/coverage.ts';
import { DECLARATION_FILES, GENERATED_SELECTIONS } from '#tests/config/repository.ts';

import {
    JEST_CASES,
    JEST_PATHS,
    MIGRATION_CASES,
    PROJECT_CHOICES,
    MIGRATION_PATHS,
    PROJECT_SELECTIONS,
} from '#tests/config/select.ts';

const manifests = configurationManifests();

test('files are covered by extension, file name at any depth, tag and glob', () => {
    const bash = manifests.get('bash')!;
    expect(
        isCovered(
            bash.files,
            buildTrackedFile('scripts/build.sh'),
            filenameMatcher(bash.files.filenames),
            pathMatcher(bash.files.paths),
        ),
    ).toBe(true);
    expect(
        isCovered(
            bash.files,
            buildTrackedFile('.gspot/hooks/pre-commit', ['text', 'shebang:shell']),
            filenameMatcher(bash.files.filenames),
            pathMatcher(bash.files.paths),
        ),
    ).toBe(true);
    expect(
        isCovered(
            bash.files,
            buildTrackedFile('README.md'),
            filenameMatcher(bash.files.filenames),
            pathMatcher(bash.files.paths),
        ),
    ).toBe(false);
    const filenames = { ...bash.files, extensions: [], filenames: ['_headers'], tags: [] };
    expect(
        isCovered(
            filenames,
            buildTrackedFile('public/_headers'),
            filenameMatcher(filenames.filenames),
            pathMatcher(filenames.paths),
        ),
    ).toBe(true);
    const paths = { ...bash.files, extensions: [], tags: [], paths: ['infra/**'] };
    expect(
        isCovered(
            paths,
            buildTrackedFile('infra/config.txt'),
            filenameMatcher(paths.filenames),
            pathMatcher(paths.paths),
        ),
    ).toBe(true);
    expect(
        isCovered(
            paths,
            buildTrackedFile('docs/config.txt'),
            filenameMatcher(paths.filenames),
            pathMatcher(paths.paths),
        ),
    ).toBe(false);
});

test('a configuration that covers the language files gets them', () => {
    const selected = selectConfigurations(['bash'], manifests);
    const structure = manifests.get('structure')!;
    const owned = coveredBy(
        structure.files,
        selected,
        [buildTrackedFile('a.sh'), buildTrackedFile('README.md')],
        '',
        [],
        {},
    );
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
])('the Prettier plugin files follow the selected configurations %j', (configurations, expected) => {
    const files = [
        buildTrackedFile('src/Page.astro'),
        buildTrackedFile('src/App.svelte'),
        buildTrackedFile('src/index.ts'),
    ];
    expect(
        coveredBy(
            manifests.get('format')!.files,
            selectConfigurations(configurations, manifests),
            files,
            '',
            [],
            {},
        ).map((entry) => entry.path),
    ).toStrictEqual([...expected]);
});

test.each(MIGRATION_CASES)(
    'migration paths in scope "%s" are covered and other file kinds are not',
    (scope, expected) => {
        const selected = selectConfigurations(['postgres'], manifests);
        const files = MIGRATION_PATHS.map((path) => buildTrackedFile(path));
        const table = manifests.get('postgres')!.files;
        const owned = coveredBy(table, selected, files, scope, [], {});
        expect(owned.map((file) => file.path)).toStrictEqual([...expected]);
        expect(owned[0]).toBe(files.find((file) => file.path === expected[0]));
        expect(coveredBy({ ...table, kinds: ['binary'] }, selected, files, scope, [], {})).toStrictEqual([]);
        expect(coveredBy({ ...table, paths: [] }, selected, files, scope, [], {})).toStrictEqual([]);
        expect(files.map((file) => file.path)).toStrictEqual([...MIGRATION_PATHS]);
    },
);

test.each([...JEST_CASES])('Jest covers the test paths of scope "$scope"', ({ scope, tests, expected }) => {
    const selected = selectConfigurations(['jest'], manifests);
    const files = JEST_PATHS.map((path) => buildTrackedFile(path));
    const owned = coveredBy(manifests.get('jest')!.files, selected, files, scope, [...tests], {});
    expect(owned.map(({ path }) => path)).toStrictEqual([...expected]);
    for (const file of owned) expect(files).toContain(file);
    expect(files.map(({ path }) => path)).toStrictEqual([...JEST_PATHS]);
});

test.each(PROJECT_SELECTIONS)('scope %s selects configuration %s: %s', (scope, name, selected) => {
    const names = selectForScope(
        {
            configurations: [...PROJECT_CHOICES.configurations],
            removed_configurations: [...PROJECT_CHOICES.removed_configurations],
            scope: Object.fromEntries(
                PROJECT_CHOICES.scope.map((entry) => [
                    entry.path,
                    {
                        configurations: [...entry.configurations],
                        removed_configurations: [...entry.removed_configurations],
                    },
                ]),
            ),
        },
        scope,
        configurationManifests(),
    ).map((manifest) => manifest.configuration.name);
    expect(names.includes(name)).toBe(selected);
    expect(names).toContain('gspot');
});

test.each([...GENERATED_SELECTIONS])(
    'the configurations each scope selects mark their generated files: $configurations $tables',
    async ({ configurations, tables, generated }) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(configurations, { tables }),
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
