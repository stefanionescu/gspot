import { test, expect } from 'bun:test';
import { splitWords } from '#cli/checks/general/naming/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import { NAME_WORD_CASES, SWIFT_NAMING_LIMITS } from '#tests/config/checks/general/naming/settings.ts';

test('category limits inherit root and scope language settings while explicit categories take precedence', () => {
    const SCOPE_LIMITS = [
        { scope: '', characters: 38, functions: 37, words: 4 },
        { scope: 'app', characters: 36, functions: 35, words: 3 },
        { scope: 'sibling', characters: 38, functions: 37, words: 4 },
    ] as const;

    const text = buildSandboxSettings(['naming'], {
        rules: true,
        tables: SWIFT_NAMING_LIMITS,
    });
    for (const { scope, characters, functions, words } of SCOPE_LIMITS) {
        const naming = buildScopeNamingSettings(text, scope);
        expect(naming.limitsFor('swift', 'functions')).toMatchObject({
            maxChars: functions,
            maxWords: words,
        });
        expect(naming.limitsFor('swift', 'variables')).toMatchObject({
            maxChars: characters,
            maxWords: words,
        });
    }
});

test.each([...NAME_WORD_CASES])(
    'splitWords splits %s at case changes, separators, and digit runs, and keeps an acronym or number word whole',
    (name, words) => {
        expect(splitWords(name)).toStrictEqual([...words]);
    },
);
