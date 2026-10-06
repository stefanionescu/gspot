import { test, expect, describe } from 'bun:test';
import { buildTrackedFile } from '#tests/harness/tracked.ts';
import { isOwned, ownedBy } from '#cli/configurations/owners.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { UNSUPPORTED_CONFIGURATION_FILES } from '#tests/config/cli/configurations/owners.ts';

const manifests = configurationManifests();

test('Configuration Files claims only formats its declared readers consume', () => {
    const files = manifests.get('files')!;
    for (const path of UNSUPPORTED_CONFIGURATION_FILES) {
        expect(isOwned(files.files, buildTrackedFile(path))).toBe(false);
        expect(isOwned(files.files, buildTrackedFile(`app/${path}`))).toBe(false);
    }
    for (const path of ['settings.json', 'settings.yaml', 'settings.toml', 'settings.xml'])
        expect(isOwned(files.files, buildTrackedFile(path))).toBe(true);
    expect(isOwned(manifests.get('site')!.files, buildTrackedFile('site.webmanifest'))).toBe(true);
});

describe('owners', () => {
    test('match by extension, filename at any depth, tag and glob', () => {
        const bash = manifests.get('bash')!;
        expect(isOwned(bash.files, buildTrackedFile('scripts/build.sh'))).toBe(true);
        expect(isOwned(bash.files, buildTrackedFile('.gspot/hooks/pre-commit', ['text', 'shebang:shell']))).toBe(true);
        expect(isOwned(bash.files, buildTrackedFile('README.md'))).toBe(false);
        const filenames = { ...bash.files, extensions: [], filenames: ['_headers'], tags: [] };
        expect(isOwned(filenames, buildTrackedFile('public/_headers'))).toBe(true);
        const paths = { ...bash.files, extensions: [], tags: [], paths: ['infra/**'] };
        expect(isOwned(paths, buildTrackedFile('infra/config.txt'))).toBe(true);
        expect(isOwned(paths, buildTrackedFile('docs/config.txt'))).toBe(false);
    });

    test('a repository configuration with language ownership selects the language files', () => {
        const selected = selectConfigurations(['bash'], manifests);
        const structure = manifests.get('structure')!;
        const owned = ownedBy(structure.files, selected, [buildTrackedFile('a.sh'), buildTrackedFile('README.md')], '');
        expect(owned.map((entry) => entry.path)).toStrictEqual(['a.sh']);
    });

    test('a scope narrows the file set', () => {
        const selected = selectConfigurations(['bash'], manifests);
        expect(
            ownedBy(
                manifests.get('bash')!.files,
                selected,
                [buildTrackedFile('api/a.sh'), buildTrackedFile('b.sh')],
                'api',
            ).map((entry) => entry.path),
        ).toStrictEqual(['api/a.sh']);
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
    ])('Prettier plugin file ownership follows the selected configurations %j', (configurations, expected) => {
        const files = [
            buildTrackedFile('src/Page.astro'),
            buildTrackedFile('src/App.svelte'),
            buildTrackedFile('src/index.ts'),
        ];
        expect(
            ownedBy(manifests.get('format')!.files, selectConfigurations(configurations, manifests), files, '').map(
                (entry) => entry.path,
            ),
        ).toStrictEqual(expected);
    });
});
