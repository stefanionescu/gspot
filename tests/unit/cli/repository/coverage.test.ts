import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { buildTrackedFile } from '#tests/setup/builders.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { selectForScope, buildFileMatcher, listCoveredFiles } from '#cli/repository/coverage.ts';
import { DECLARATION_FILES, GENERATED_SELECTIONS } from '#tests/data/repository/file-classification.ts';

import {
    JEST_CASES,
    JEST_PATHS,
    MIGRATION_CASES,
    MIGRATION_PATHS,
    PROJECT_CHOICES,
    PROJECT_SELECTIONS,
} from '#tests/data/configurations/detection.ts';

test('files are covered by extension, file name at any depth, tag and glob', () => {
    const manifests = readManifests(createReadCache(process.cwd()));

    const bash = manifests.get('bash')!;
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
    const manifests = readManifests(createReadCache(process.cwd()));

    const selected = selectConfigurations(['bash'], manifests);
    const structure = manifests.get('structure')!;
    const owned = listCoveredFiles(structure.files, [buildTrackedFile('a.sh'), buildTrackedFile('README.md')], {
        selected: selected,
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
])('the Prettier plugin files follow the selected configurations %j', (configurations, expected) => {
    const manifests = readManifests(createReadCache(process.cwd()));

    const files = [
        buildTrackedFile('src/Page.astro'),
        buildTrackedFile('src/App.svelte'),
        buildTrackedFile('src/index.ts'),
    ];
    expect(
        listCoveredFiles(manifests.get('format')!.files, files, {
            selected: selectConfigurations(configurations, manifests),
            scope: '',
            view: { test_files: [], settings: {} },
        }).map((entry) => entry.path),
    ).toStrictEqual([...expected]);
});

test.each(MIGRATION_CASES)(
    'migration paths in scope "%s" are covered and other file kinds are not',
    (scope, expected) => {
        const manifests = readManifests(createReadCache(process.cwd()));

        const selected = selectConfigurations(['postgres'], manifests);
        const files = MIGRATION_PATHS.map((path) => buildTrackedFile(path));
        const table = manifests.get('postgres')!.files;
        const owned = listCoveredFiles(table, files, {
            selected: selected,
            scope: scope,
            view: { test_files: [], settings: {} },
        });
        expect(owned.map((file) => file.path)).toStrictEqual([...expected]);
        expect(
            listCoveredFiles({ ...table, kinds: ['binary'] }, files, {
                selected: selected,
                scope: scope,
                view: { test_files: [], settings: {} },
            }),
        ).toStrictEqual([]);
        expect(
            listCoveredFiles({ ...table, paths: [] }, files, {
                selected: selected,
                scope: scope,
                view: { test_files: [], settings: {} },
            }),
        ).toStrictEqual([]);
        expect(files.map((file) => file.path)).toStrictEqual([...MIGRATION_PATHS]);
    },
);

test.each([...JEST_CASES])('Jest covers the test paths of scope "$scope"', ({ scope, tests, expected }) => {
    const manifests = readManifests(createReadCache(process.cwd()));

    const selected = selectConfigurations(['jest'], manifests);
    const files = JEST_PATHS.map((path) => buildTrackedFile(path));
    const owned = listCoveredFiles(manifests.get('jest')!.files, files, {
        selected: selected,
        scope: scope,
        view: { test_files: [...tests], settings: {} },
    });
    expect(owned.map(({ path }) => path)).toStrictEqual([...expected]);
    expect(files.map(({ path }) => path)).toStrictEqual([...JEST_PATHS]);
});

test.each(PROJECT_SELECTIONS)('scope %s selects configuration %s: %s', (scope, name, selected) => {
    const names = selectForScope(
        {
            configurations: [...PROJECT_CHOICES.configurations],
            removed_configurations: [...PROJECT_CHOICES.removed_configurations],
            scopes: Object.fromEntries(
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
        readManifests(createReadCache(process.cwd())),
    ).map((manifest) => manifest.configuration.name);
    expect(names.includes(name)).toBe(selected);
    expect(names).toContain('gspot');
});

test.each([...GENERATED_SELECTIONS])(
    'the configurations each scope selects mark their generated files: $configurations $tables',
    async ({ configurations, tables, generated }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(configurations, { tables }),
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

describe('selectors', () => {
    test('path selectors: ** crosses folders and ! negates', () => {
        const matcher = buildPathMatcher(['scripts/**', '!scripts/vendor/**']);
        expect(matcher('scripts/a/b.sh')).toBe(true);
        expect(matcher('scripts/vendor/x.sh')).toBe(false);
        expect(matcher('scripts/line\nbreak.sh')).toBe(true);
        expect(matcher('scripts/vendor/line\nbreak.sh')).toBe(false);
    });
});
