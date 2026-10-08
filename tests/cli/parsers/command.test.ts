import { test, expect } from 'bun:test';
import { parseNextBuildFlags } from '#cli/parsers/bash/contracts.ts';

test('Next.js build scripts preserve quoted paths and empty flags while refusing unresolved expansions', () => {
    expect(parseNextBuildFlags(`NODE_ENV=production next build "two words" "" --webpack && echo done`)).toStrictEqual([
        'two words',
        '',
        '--webpack',
    ]);
    expect(() => parseNextBuildFlags('next build $FLAGS')).toThrow('unresolved command or flag expansions');
});

test('Next.js build scripts decode an escaped space as one literal argument', () => {
    expect(parseNextBuildFlags(String.raw`next build two\ words`)).toStrictEqual(['two words']);
});
