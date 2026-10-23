import { test, expect } from 'bun:test';
import { splitParts } from '#cli/checks/general/naming/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import { SCOPE_LIMITS, NAME_WORD_CASES, SWIFT_NAMING_LIMITS } from '#tests/config/checks/general/naming/settings.ts';

test('category limits inherit root and scope language settings while explicit categories take precedence', () => {
    const text = buildSandboxSettings(['naming'], {
        rules: true,
        tables: SWIFT_NAMING_LIMITS,
    });
    for (const { scope, characters, functions, words } of SCOPE_LIMITS) {
        const effective = buildScopeNamingSettings(text, scope);
        expect(effective.limitsFor('swift', 'functions')).toMatchObject({
            maxChars: functions,
            maxWords: words,
        });
        expect(effective.limitsFor('swift', 'variables')).toMatchObject({
            maxChars: characters,
            maxWords: words,
        });
    }
});
test.each([...NAME_WORD_CASES])(
    'splitParts splits %s at case changes, separators, and digit runs, and keeps an acronym or number word whole',
    (name, words) => {
        expect(splitParts(name)).toStrictEqual([...words]);
    },
);
