import { claimedByClaims, isClaimed } from '#cli/configurations/claims.ts';
import { detectConfigurations, unknownLanguages } from '#cli/configurations/detect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { shebangInterpreter } from '#cli/repository/shebang.ts';
import { describe, expect, test } from 'bun:test';

const file = (path: string, tags: string[] = ['text']): TrackedFile => ({
    path,
    prefix: Buffer.alloc(0),
    nature: 'source',
    tags,
    executable: false,
    size: 1,
});
const manifests = configurationManifests();

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

    test('a repository configuration with from_languages claims what the language configurations claim', () => {
        const selected = selectConfigurations(['bash'], manifests);
        const structure = manifests.get('structure')!;
        const claimed = claimedByClaims(structure.claims, selected, [file('a.sh'), file('README.md')], '');
        expect(claimed.map((entry) => entry.path)).toStrictEqual(['a.sh']);
    });

    test('a scope narrows the file set', () => {
        const selected = selectConfigurations(['bash'], manifests);
        expect(
            claimedByClaims(manifests.get('bash')!.claims, selected, [file('api/a.sh'), file('b.sh')], 'api').map(
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
        const proposals = detectConfigurations([file('a.sh')], manifests, []);
        expect(proposals.find((proposal) => proposal.configuration === 'bash')?.evidence).toBe('1 .sh file');
        expect(proposals.some((proposal) => proposal.configuration === 'spelling')).toBe(true);
    });

    test('names a language gspot has no configuration for through Linguist', () => {
        const unknown = unknownLanguages([file('main.kt'), file('lib.kt'), file('x.sh')], manifests);
        expect(unknown[0]).toStrictEqual({ language: 'Kotlin', extensions: ['.kt'], count: 2 });
    });

    test('names unsupported source languages and disambiguates a module filename', () => {
        const module = file('go.mod');
        const proposals = detectConfigurations([module], manifests, []);
        expect(proposals.filter((proposal) => proposal.kind === 'language')).toStrictEqual([]);
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

test('security combines language claims with plist inputs', () => {
    const selected = selectConfigurations(['swift', 'security'], manifests);
    const security = manifests.get('security')!;
    const claimed = claimedByClaims(
        security.claims,
        selected,
        [file('App.swift'), file('Info.plist'), file('notes.md')],
        '',
    );
    expect(claimed.map((entry) => entry.path)).toStrictEqual(['App.swift', 'Info.plist']);
});
