import { test, expect } from 'bun:test';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildTrackedFile } from '#tests/setup/cli/repository.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { listCoveredFiles, buildFileMatcher } from '#cli/repository/files/selection.ts';

import {
    JEST_CASES,
    JEST_PATHS,
    MIGRATION_CASES,
    PRETTIER_PLUGIN_CASES,
} from '#tests/config/repository/files/selection.ts';

test('files are covered by extension, file name at any depth, tag and glob', () => {
    const configurationsByName = readConfigurations();

    const bash = configurationsByName.get('bash')!;
    expect(buildFileMatcher(bash.files)(buildTrackedFile('scripts/build.sh'))).toBe(true);
    expect(
        buildFileMatcher(bash.files)(buildTrackedFile(`${GSPOT_PATHS.hooks}/pre-commit`, ['text', 'shebang:shell'])),
    ).toBe(true);
    expect(buildFileMatcher(bash.files)(buildTrackedFile('README.md'))).toBe(false);
    const filenames = { ...bash.files, extensions: [], filenames: ['_headers'], tags: [] };
    expect(buildFileMatcher(filenames)(buildTrackedFile('public/_headers'))).toBe(true);
    const paths = { ...bash.files, extensions: [], tags: [], paths: ['infra/**'] };
    expect(buildFileMatcher(paths)(buildTrackedFile('infra/config.txt'))).toBe(true);
    expect(buildFileMatcher(paths)(buildTrackedFile('docs/config.txt'))).toBe(false);
});

test('with bash selected, structure covers the Bash script and not README.md', () => {
    const configurationsByName = readConfigurations();

    const selected = selectConfigurations(['bash'], configurationsByName);
    const structure = configurationsByName.get('structure')!;
    const owned = listCoveredFiles(structure.files, [buildTrackedFile('a.sh'), buildTrackedFile('README.md')], {
        configurations: selected,
        scopePath: '',
        settings: { test_files: [], valuesByKey: {} },
    });
    expect(owned.map((file) => file.path)).toStrictEqual(['a.sh']);
});

test.each([...PRETTIER_PLUGIN_CASES])(
    'the Prettier plugin files follow the selected configurations %j',
    (configurationNames, expected) => {
        const configurationsByName = readConfigurations();

        const files = [
            buildTrackedFile('src/Page.astro'),
            buildTrackedFile('src/App.svelte'),
            buildTrackedFile('src/index.ts'),
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
            (path) => buildTrackedFile(path),
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
    const files = JEST_PATHS.map((path) => buildTrackedFile(path));
    const owned = listCoveredFiles(configurationsByName.get('jest')!.files, files, {
        configurations: selected,
        scopePath: scope,
        settings: { test_files: [...tests], valuesByKey: {} },
    });
    expect(owned.map(({ path }) => path)).toStrictEqual([...expected]);
});
