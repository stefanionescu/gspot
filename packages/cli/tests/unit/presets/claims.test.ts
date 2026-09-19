import { describe, expect, test } from 'bun:test';
import { selectPresets } from '#cli/presets/select.ts';
import type { TrackedFile } from '#types/repository.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { claimedFiles, isClaimed, pathMatcher } from '#cli/presets/claims.ts';
import { detectPresets, shebangInterpreter, unknownLanguages } from '#cli/presets/detect.ts';

const file = (path: string, tags: string[] = ['text']): TrackedFile => ({
    path,
    nature: 'source',
    tags,
    executable: false,
    size: 1,
});
const manifests = presetManifests();

describe('claims', () => {
    test('match by extension, filename at any depth, tag and glob', () => {
        const bash = manifests.get('bash')!;
        expect(isClaimed(bash.claims, file('scripts/build.sh'))).toBe(true);
        expect(isClaimed(bash.claims, file('.gspot/hooks/pre-commit', ['text', 'shebang:shell']))).toBe(true);
        expect(isClaimed(bash.claims, file('README.md'))).toBe(false);
        expect(
            isClaimed(
                {
                    extensions: [],
                    filenames: ['_headers'],
                    tags: [],
                    paths: [],
                    from_languages: false,
                    natures: ['source'],
                },
                file('public/_headers'),
            ),
        ).toBe(true);
    });

    test('a repository preset with from_languages claims what the language presets claim', () => {
        const selected = selectPresets(['bash'], manifests);
        const structure = manifests.get('structure')!;
        const claimed = claimedFiles(structure, selected, [file('a.sh'), file('README.md')], '');
        expect(claimed.map((entry) => entry.path)).toEqual(['a.sh']);
    });

    test('a scope narrows the file set', () => {
        const selected = selectPresets(['bash'], manifests);
        expect(
            claimedFiles(manifests.get('bash')!, selected, [file('api/a.sh'), file('b.sh')], 'api').map(
                (entry) => entry.path,
            ),
        ).toEqual(['api/a.sh']);
    });

    test('path selectors: ** crosses directories, ! negates', () => {
        const matcher = pathMatcher(['scripts/**', '!scripts/vendor/**']);
        expect(matcher('scripts/a/b.sh')).toBe(true);
        expect(matcher('scripts/vendor/x.sh')).toBe(false);
    });
});

describe('detection', () => {
    test('proposes a language from an extension and the defaults for every repository', () => {
        const proposals = detectPresets([file('a.sh')], manifests, []);
        expect(proposals.find((proposal) => proposal.preset === 'bash')?.evidence).toBe('1 .sh file');
        expect(proposals.some((proposal) => proposal.preset === 'spelling')).toBe(true);
    });

    test('names a language gspot has no preset for through Linguist', () => {
        const unknown = unknownLanguages([file('main.kt'), file('lib.kt'), file('x.sh')], manifests);
        expect(unknown[0]).toEqual({ language: 'Kotlin', extensions: ['.kt'], count: 2 });
    });

    test('reads the interpreter from a shebang', () => {
        expect(shebangInterpreter('#!/usr/bin/env bash')).toBe('shell');
        expect(shebangInterpreter('#!/bin/sh')).toBe('shell');
        expect(shebangInterpreter('#!/usr/bin/env -S bun run')).toBe('node');
        expect(shebangInterpreter('#!/usr/bin/python3')).toBe('python');
        expect(shebangInterpreter('plain text')).toBeUndefined();
    });
});
