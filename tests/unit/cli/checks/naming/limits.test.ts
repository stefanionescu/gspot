import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { validateIdentifier } from '#cli/checks/naming/rules.ts';
import { buildIdentifier, buildFileNaming, buildScopeNamingSettings } from '#tests/setup/builders.ts';

import {
    NAME_WORDS,
    SCOPE_LIMITS,
    NAMING_LANGUAGES,
    LINTER_LIMIT_CASES,
    SWIFT_NAMING_LIMITS,
    UPPER_SNAKE_OVERRIDE,
} from '#tests/data/checks/naming/settings.ts';

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

test.each([...NAMING_LANGUAGES])('%s accepts its exact limits and reports the next character or word', (language) => {
    const effective = buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
    const category = language === 'swift' || language === 'sql' ? 'functions' : 'variables';
    const { maxChars: characters, maxWords: words } = effective.limitsFor(language, category);
    const context = buildFileNaming(effective);
    const declaration = buildIdentifier({
        file: 'source',
        language,
        category,
        label: category,
        name: 'z'.repeat(characters),
        line: 1,
        column: 1,
    });
    expect(validateIdentifier(declaration, context)).toStrictEqual([]);
    expect(
        validateIdentifier({ ...declaration, name: 'z'.repeat(characters + 1) }, context).map(({ rule }) => rule),
    ).toStrictEqual(['length']);
    const separator = ['python', 'bash', 'sql'].includes(language) ? '_' : '';
    const parts = NAME_WORDS.map((word, index) =>
        separator === '' && index > 0 ? word.slice(0, 1).toUpperCase() + word.slice(1) : word,
    );
    expect(validateIdentifier({ ...declaration, name: parts.slice(0, words).join(separator) }, context)).toStrictEqual(
        [],
    );
    expect(
        validateIdentifier({ ...declaration, name: parts.slice(0, words + 1).join(separator) }, context).map(
            ({ rule }) => rule,
        ),
    ).toStrictEqual(['words']);
});

test.each([...LINTER_LIMIT_CASES])(
    '$language $category with a 41-letter name reports $expected, and too many words are still reported',
    ({ language, category, expected }) => {
        const effective = buildScopeNamingSettings(
            buildSandboxSettings(['naming'], {
                rules: true,
                level: 'all',
                tables: UPPER_SNAKE_OVERRIDE,
            }),
        );
        const context = buildFileNaming(effective);
        const identifier = buildIdentifier({
            file: 'source',
            language,
            category,
            label: category,
            name: 'a'.repeat(41),
            line: 1,
            column: 1,
        });
        expect(validateIdentifier(identifier, context).map(({ rule }) => rule)).toStrictEqual([...expected]);
        expect(
            validateIdentifier({ ...identifier, name: NAME_WORDS.join('_') }, context).map(({ rule }) => rule),
        ).toContain('words');
    },
);

test("a framework's naming rules come after the shipped ones and before the repository's", () => {
    const text = buildSandboxSettings(['typescript', 'express'], {
        rules: true,
        tables: '[naming]\nbanned_words = ["handle", "use"]\n[[naming.override]]\npaths = ["src/hooks/**"]\ncategories = ["functions"]\nignored_prefix = "^use(?=[A-Z])"\nreason = "A hook starts with use."\n',
    });
    const effective = buildScopeNamingSettings(text);
    const declaration = buildIdentifier({
        file: 'src/routes/auth.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        label: 'function',
        name: 'handleLogin',
    });
    const context = buildFileNaming(effective);
    expect(validateIdentifier(declaration, context)).toStrictEqual([]);
    expect(validateIdentifier({ ...declaration, file: 'src/hooks/login.ts', name: 'useLogin' }, context)).toStrictEqual(
        [],
    );
    expect(
        validateIdentifier({ ...declaration, file: 'src/routes/login.ts', name: 'useLogin' }, context).map(
            ({ rule }) => rule,
        ),
    ).toContain('banned-word');
    expect(
        validateIdentifier(
            { ...declaration, file: 'src/app.py', language: 'python', name: 'handle_login' },
            context,
        ).map(({ rule }) => rule),
    ).toContain('banned-word');
});
