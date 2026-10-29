import { test, expect } from 'bun:test';
import { splitWords } from '#cli/checks/general/naming/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import { NAME_WORD_CASES, SWIFT_NAMING_LIMITS } from '#tests/config/checks/general/naming/settings.ts';

test('category limits inherit root and scope language settings while explicit categories take precedence', () => {
    const text = buildSandboxSettings(['naming'], {
        rules: true,
        tables: SWIFT_NAMING_LIMITS,
    });
    for (const { scope, characters, functions, words } of [
        { scope: '', characters: 38, functions: 37, words: 4 },
        { scope: 'app', characters: 36, functions: 35, words: 3 },
        { scope: 'sibling', characters: 38, functions: 37, words: 4 },
    ] as const) {
        const naming = buildScopeNamingSettings(text, scope);
        expect(naming.limitLookup('swift', 'functions')).toStrictEqual({
            cases: ['camel'],
            maxCharacters: functions,
            maxWords: words,
        });
        expect(naming.limitLookup('swift', 'variables')).toStrictEqual({
            cases: [],
            maxCharacters: characters,
            maxWords: words,
        });
    }
});

test.each([...NAME_WORD_CASES])(
    'splitWords splits %s at case changes, separators, and digit runs, and keeps an acronym or a number word as one word',
    (name, words) => {
        expect(splitWords(name)).toStrictEqual([...words]);
    },
);
