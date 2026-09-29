import { selectKits } from '#cli/kits/select.ts';
import { test, expect, describe } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';
import { isOwned, ownedBy } from '#cli/kits/owners.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { shebangInterpreter } from '#cli/repository/tags.ts';
import { detectKits, unknownLanguages } from '#cli/kits/detect.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
const file = (path: string, tags: string[] = ['text']): TrackedFile => ({
    path,
    prefix: Buffer.alloc(0),
    kind: 'source',
    tags,
    executable: false,
    size: 1,
});
const manifests = kitManifests();

describe('owners', () => {
    test('match by extension, filename at any depth, tag and glob', () => {
        const bash = manifests.get('bash')!;
        expect(isOwned(bash.owners, file('scripts/build.sh'))).toBe(true);
        expect(isOwned(bash.owners, file('.gspot/hooks/pre-commit', ['text', 'shebang:shell']))).toBe(true);
        expect(isOwned(bash.owners, file('README.md'))).toBe(false);
        expect(
            isOwned(
                {
                    extensions: [],
                    filenames: ['_headers'],
                    tags: [],
                    paths: [],
                    from_languages: false,
                    kinds: ['source'],
                },
                file('public/_headers'),
            ),
        ).toBe(true);
    });

    test('a repository configuration with from_languages owners what the language kits claim', () => {
        const selected = selectKits(['bash'], manifests);
        const structure = manifests.get('structure')!;
        const owned = ownedBy(structure.owners, selected, [file('a.sh'), file('README.md')], '');
        expect(owned.map((entry) => entry.path)).toStrictEqual(['a.sh']);
    });

    test('a scope narrows the file set', () => {
        const selected = selectKits(['bash'], manifests);
        expect(
            ownedBy(manifests.get('bash')!.owners, selected, [file('api/a.sh'), file('b.sh')], 'api').map(
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
        const plans = detectKits([file('a.sh')], manifests, []);
        expect(plans.find((plan) => plan.kit === 'bash')?.evidence).toBe('1 .sh file');
        expect(plans.some((plan) => plan.kit === 'spelling')).toBe(true);
    });

    test('names a language gspot has no configuration for through Linguist', () => {
        const unknown = unknownLanguages([file('main.kt'), file('lib.kt'), file('x.sh')], manifests);
        expect(unknown[0]).toStrictEqual({ language: 'Kotlin', extensions: ['.kt'], count: 2 });
    });

    test('Sass is a language without a configuration, and a stylesheet proposes css alone', () => {
        const files = [file('theme.scss'), file('site.css')];
        const plans = detectKits(files, manifests, []);
        expect(plans.find((plan) => plan.kit === 'css')?.evidence).toBe('1 .css file');
        expect(unknownLanguages(files, manifests)).toStrictEqual([
            { language: 'SCSS', extensions: ['.scss'], count: 1 },
        ]);
    });

    test('names unsupported source languages and disambiguates a module filename', () => {
        const module = file('go.mod');
        const plans = detectKits([module], manifests, []);
        expect(plans.filter((plan) => plan.kind === 'language')).toStrictEqual([]);
        const unknown = unknownLanguages([module, file('main.go'), file('lib.rs'), file('app.rb')], manifests);
        expect(unknown).toStrictEqual([
            { language: 'Go Module', extensions: ['.mod'], count: 1 },
            { language: 'Go', extensions: ['.go'], count: 1 },
            { language: 'Rust', extensions: ['.rs'], count: 1 },
            { language: 'Ruby', extensions: ['.rb'], count: 1 },
        ]);
    });

    test('reads the interpreter from a shebang', () => {
        expect(shebangInterpreter('#!/usr/bin/env bash')).toBe('shell');
        expect(shebangInterpreter('#!/bin/sh')).toBe('shell');
        expect(shebangInterpreter('#!/usr/bin/env -S bun run')).toBe('node');
        expect(shebangInterpreter('#!/usr/bin/python3')).toBe('python');
        expect(shebangInterpreter('plain text')).toBeUndefined();
    });
});

test('security combines language owners with plist inputs', () => {
    const selected = selectKits(['swift', 'security'], manifests);
    const security = manifests.get('security')!;
    const owned = ownedBy(security.owners, selected, [file('App.swift'), file('Info.plist'), file('notes.md')], '');
    expect(owned.map((entry) => entry.path)).toStrictEqual(['App.swift', 'Info.plist']);
});
