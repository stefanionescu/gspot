import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { SOURCE_KIND } from '#cli/config/repository/files/classify.ts';
import { listCoveredFiles, buildFileMatcher } from '#cli/repository/files/selection.ts';

import {
    JEST_CASES,
    JEST_PATHS,
    TRACKED_SOURCE,
    MIGRATION_CASES,
    PRETTIER_PLUGIN_CASES,
} from '#tests/config/repository/files/selection.ts';

test('files are covered by extension, file name at any depth, tag and glob', () => {
    const configurationsByName = readConfigurations();

    const bash = configurationsByName.get('bash')!;
    expect(
        buildFileMatcher(bash.files)({
            ...TRACKED_SOURCE,
            path: 'scripts/build.sh',
        }),
    ).toBe(true);
    expect(
        buildFileMatcher(bash.files)({
            path: `${GSPOT_PATHS.hooks}/pre-commit`,
            ...TRACKED_SOURCE,
            tags: ['text', 'shebang:shell'],
        }),
    ).toBe(true);
    expect(
        buildFileMatcher(bash.files)({
            ...TRACKED_SOURCE,
            path: 'README.md',
        }),
    ).toBe(false);
    const filenames = { ...bash.files, extensions: [], filenames: ['_headers'], tags: [] };
    expect(
        buildFileMatcher(filenames)({
            ...TRACKED_SOURCE,
            path: 'public/_headers',
        }),
    ).toBe(true);
    const paths = { ...bash.files, extensions: [], tags: [], paths: ['infra/**'] };
    expect(
        buildFileMatcher(paths)({
            ...TRACKED_SOURCE,
            path: 'infra/config.txt',
        }),
    ).toBe(true);
    expect(
        buildFileMatcher(paths)({
            ...TRACKED_SOURCE,
            path: 'docs/config.txt',
        }),
    ).toBe(false);
});

test('with bash selected, structure covers the Bash script and not README.md', () => {
    const configurationsByName = readConfigurations();

    const selected = selectConfigurations(['bash'], configurationsByName);
    const structure = configurationsByName.get('structure')!;
    const owned = listCoveredFiles(
        structure.files,
        [
            {
                path: 'a.sh',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
            {
                path: 'README.md',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
        ],
        {
            configurations: selected,
            scopePath: '',
            settings: { test_files: [], valuesByKey: {} },
        },
    );
    expect(owned.map((file) => file.path)).toStrictEqual(['a.sh']);
});

test.each([...PRETTIER_PLUGIN_CASES])(
    'the Prettier plugin files follow the selected configurations %j',
    (configurationNames, expected) => {
        const configurationsByName = readConfigurations();

        const files = [
            {
                path: 'src/Page.astro',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
            {
                path: 'src/App.svelte',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
            {
                path: 'src/index.ts',
                kind: 'source' as const,
                kindOrigin: SOURCE_KIND.origin,
                tags: ['text'],
                executable: false,
                size: 1,
            },
        ];
        expect(
            listCoveredFiles(configurationsByName.get('format')!.files, files, {
                configurations: selectConfigurations([...configurationNames], configurationsByName),
                scopePath: '',
                settings: { test_files: [], valuesByKey: {} },
            }).map((coveredFile) => coveredFile.path),
        ).toStrictEqual([...expected]);
    },
);

test.each(MIGRATION_CASES)(
    'migration paths in scope "%s" are covered and other file kinds are not',
    (scope, expected) => {
        const configurationsByName = readConfigurations();

        const files = ['migrations/V1_root.sql', 'app/migrations/V2_first.sql', 'other/migrations/V3_other.sql'].map(
            (path) => ({
                path,
                ...TRACKED_SOURCE,
            }),
        );
        const table = configurationsByName.get('postgres')!.files;
        const options = {
            configurations: selectConfigurations(['postgres'], configurationsByName),
            scopePath: scope,
            settings: { test_files: [], valuesByKey: {} },
        };
        const owned = listCoveredFiles(table, files, options);
        expect(owned.map((file) => file.path)).toStrictEqual([...expected]);
        expect(listCoveredFiles({ ...table, kinds: ['binary'] }, files, options)).toStrictEqual([]);
        expect(listCoveredFiles({ ...table, paths: [] }, files, options)).toStrictEqual([]);
    },
);

test.each([...JEST_CASES])('Jest covers the test paths of scope "$scope" with $tests', ({ scope, tests, expected }) => {
    const configurationsByName = readConfigurations();

    const selected = selectConfigurations(['jest'], configurationsByName);
    const files = JEST_PATHS.map((path) => ({
        path,
        ...TRACKED_SOURCE,
    }));
    const owned = listCoveredFiles(configurationsByName.get('jest')!.files, files, {
        configurations: selected,
        scopePath: scope,
        settings: { test_files: [...tests], valuesByKey: {} },
    });
    expect(owned.map(({ path }) => path)).toStrictEqual([...expected]);
});
