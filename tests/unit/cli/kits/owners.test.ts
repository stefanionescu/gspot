import { detectKits } from '#cli/kits/detect.ts';
import { selectKits } from '#cli/kits/select.ts';
import { test, expect, describe } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';
import { isOwned, ownedBy } from '#cli/kits/owners.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { trackedFile } from '#tests/harness/cli/tracked.ts';
import { shebangInterpreter } from '#cli/repository/tags.ts';

const manifests = kitManifests();

describe('owners', () => {
    test('match by extension, filename at any depth, tag and glob', () => {
        const bash = manifests.get('bash')!;
        expect(isOwned(bash.files, trackedFile('scripts/build.sh'))).toBe(true);
        expect(isOwned(bash.files, trackedFile('.gspot/hooks/pre-commit', ['text', 'shebang:shell']))).toBe(true);
        expect(isOwned(bash.files, trackedFile('README.md'))).toBe(false);
        expect(
            isOwned(
                {
                    extensions: [],
                    filenames: ['_headers'],
                    tags: [],
                    paths: [],
                    languages: false,
                    prettier_plugins: false,
                    kinds: ['source'],
                },
                trackedFile('public/_headers'),
            ),
        ).toBe(true);
    });

    test('a repository configuration with languages owners what the language kits claim', () => {
        const selected = selectKits(['bash'], manifests);
        const structure = manifests.get('structure')!;
        const owned = ownedBy(structure.files, selected, [trackedFile('a.sh'), trackedFile('README.md')], '');
        expect(owned.map((entry) => entry.path)).toStrictEqual(['a.sh']);
    });

    test('a scope narrows the file set', () => {
        const selected = selectKits(['bash'], manifests);
        expect(
            ownedBy(manifests.get('bash')!.files, selected, [trackedFile('api/a.sh'), trackedFile('b.sh')], 'api').map(
                (entry) => entry.path,
            ),
        ).toStrictEqual(['api/a.sh']);
    });

    test('path selectors: ** crosses directories, ! negates', () => {
        const matcher = pathMatcher(['scripts/**', '!scripts/vendor/**']);
        expect(matcher('scripts/a/b.sh')).toBe(true);
        expect(matcher('scripts/vendor/x.sh')).toBe(false);
        expect(matcher('scripts/line\nbreak.sh')).toBe(true);
        expect(matcher('scripts/vendor/line\nbreak.sh')).toBe(false);
    });
});

describe('detection', () => {
    test('proposes a language from an extension and the defaults for every repository', () => {
        const plans = detectKits([trackedFile('a.sh')], manifests, []);
        expect(plans.find((plan) => plan.kit === 'bash')?.evidence).toBe('1 .sh file');
        expect(plans.some((plan) => plan.kit === 'spelling')).toBe(true);
    });

    test('reads the interpreter from a shebang', () => {
        expect(shebangInterpreter('#!/usr/bin/env bash')).toBe('shell');
        expect(shebangInterpreter('#!/bin/sh')).toBe('shell');
        expect(shebangInterpreter('#!/usr/bin/env -S bun run')).toBe('node');
        expect(shebangInterpreter('#!/usr/bin/python3')).toBe('python');
        expect(shebangInterpreter('plain text')).toBeUndefined();
    });
});

test('owners > Prettier formats a plugin file type only while the kit with that plugin is selected', () => {
    const formatting = manifests.get('format')!.files;
    const files = [trackedFile('src/Page.astro'), trackedFile('src/App.svelte'), trackedFile('src/index.ts')];
    for (const [kits, expected] of [
        [['format', 'typescript'], ['src/index.ts']],
        [
            ['format', 'typescript', 'astro'],
            ['src/Page.astro', 'src/index.ts'],
        ],
        [
            ['format', 'typescript', 'svelte'],
            ['src/App.svelte', 'src/index.ts'],
        ],
    ] as const)
        expect(
            ownedBy(formatting, selectKits([...kits], manifests), files, '').map((entry) => entry.path),
        ).toStrictEqual([...expected]);
});
