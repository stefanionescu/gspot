import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { validateIdentifier } from '#cli/checks/general/naming/rules.ts';
import type { FileNaming, Identifier } from '#cli/types/checks/general/naming.ts';
import { buildFileNaming, buildIdentifier, buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';

import {
    NAME_WORDS,
    OVERLONG_NAME,
    NAMING_LANGUAGES,
    LINTER_LIMIT_CASES,
    BANNED_WORD_TABLES,
    HOOK_PREFIX_TABLES,
    ALLOWED_NAME_TABLES,
    UPPER_SNAKE_OVERRIDE,
    HANDLE_PREFIX_TABLES,
    OVERLONG_NAME_FINDINGS,
    ACCEPTANCE_DIGIT_TABLES,
    HANDLE_ROUTE_IDENTIFIER,
} from '#tests/config/checks/general/naming/rules.ts';

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
test('the JavaScript handle override and a repository use override strip their prefixes only in their own files and languages', () => {
    const naming = readNaming(HOOK_PREFIX_TABLES);
    const declaration = buildIdentifier(HANDLE_ROUTE_IDENTIFIER);
    expect(validateIdentifier(declaration, naming)).toStrictEqual([]);
    expect(validateIdentifier({ ...declaration, file: 'src/hooks/login.ts', name: 'useLogin' }, naming)).toStrictEqual(
        [],
    );
    expect(listRuleMessages({ ...declaration, file: 'src/routes/login.ts', name: 'useLogin' }, naming)).toStrictEqual([
        { rule: 'banned-word', message: 'function "useLogin": "use" is banned (naming.banned_words).' },
    ]);
    expect(
        listRuleMessages({ ...declaration, file: 'src/app.py', language: 'python', name: 'handle_login' }, naming),
    ).toStrictEqual([
        { rule: 'banned-word', message: 'function "handle_login": "handle" is banned (naming.banned_words).' },
    ]);
});

test('a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported', () => {
    const effective = buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
    const context = buildFileNaming({ ...effective, limitsFor: () => ({ caseNames: [], maxChars: 35, maxWords: 4 }) });
    const declaration = buildIdentifier({ name: 'base64User', category: 'variables', file: 'source.ts' });
    expect(validateIdentifier(declaration, context)).toStrictEqual([]);
    expect(
        validateIdentifier({ ...declaration, name: 'base64UserUser' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['duplicate-words']);
    expect(
        validateIdentifier({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context).map(({ rule }) => rule),
    ).toStrictEqual(['words']);
    expect(validateIdentifier({ ...declaration, name: 'base64Helper' }, context).map(({ rule }) => rule)).toStrictEqual(
        ['banned-word'],
    );
    expect(validateIdentifier({ ...declaration, name: 'user2' }, context).map(({ rule }) => rule)).toStrictEqual([
        'digits',
    ]);
});

test('a name with a digit, too many characters and words, a repeated word, and a banned word gets all five findings, and the banned-word message names its group', () => {
    expect(listRuleMessages(buildIdentifier({ name: OVERLONG_NAME }), readNaming(''))).toStrictEqual([
        ...OVERLONG_NAME_FINDINGS,
    ]);
});

test('case follows the category, and a file name is checked part by part between dots', () => {
    const naming = readNaming('');
    expect(listRuleMessages(buildIdentifier({ name: 'my_type', category: 'types' }), naming)).toStrictEqual([
        { rule: 'case', message: 'typescript types "my_type": expected pascal case.' },
    ]);
    expect(validateIdentifier(buildIdentifier({ name: 'bash.test', category: 'files' }), naming)).toStrictEqual([]);
});

test('the naming check accepts _ as a variable, a digit in a tests/ path, and a Bash name with an ignored prefix', () => {
    const naming = readNaming(ACCEPTANCE_DIGIT_TABLES);
    expect(validateIdentifier(buildIdentifier({ name: '_', category: 'variables' }), naming)).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: 'user2', category: 'variables', file: 'tests/acceptance/a.ts' }),
            naming,
        ),
    ).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: '_private_step', category: 'functions', file: 'scripts/a.sh', language: 'bash' }),
            naming,
        ),
    ).toStrictEqual([]);
});

test('allowed names and path overrides skip the naming rules', () => {
    const naming = readNaming(ALLOWED_NAME_TABLES);
    expect(validateIdentifier(buildIdentifier({ name: 'requestAnimationFrame' }), naming)).toStrictEqual([]);
    expect(
        validateIdentifier(
            buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/route.ts' }),
            naming,
        ),
    ).toStrictEqual([]);
    expect(
        listRuleMessages(
            buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/internal.ts' }),
            naming,
        ),
    ).toStrictEqual([
        { rule: 'case', message: 'typescript properties "Content-Type": expected camel or upper-snake case.' },
    ]);
});

test('a reserved word is allowed only in its named categories', () => {
    const naming = readNaming('');
    expect(validateIdentifier(buildIdentifier({ name: 'config', category: 'variables' }), naming)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'config', category: 'folders' }), naming)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'ConfigFile', category: 'types' }), naming)).toStrictEqual([]);
    expect(validateIdentifier(buildIdentifier({ name: 'readConfigFile' }), naming)).toStrictEqual([]);
    expect(listRuleMessages(buildIdentifier({ name: 'ConfigReader', category: 'classes' }), naming)).toStrictEqual([
        {
            rule: 'reserved-term',
            message:
                'typescript classes "ConfigReader": "config" is reserved for folders, packages, files, modules, types, functions, variables, constants, parameters, properties, attributes, enum_cases; this is a typescript classes.',
        },
    ]);
});

test('a word of the shipped tests group passes in a test file, and the same word from banned_words is reported there', () => {
    const declaration = buildIdentifier({ name: 'actualRoot' });
    expect(validateIdentifier(declaration, { ...readNaming(''), isTestFile: true })).toStrictEqual([]);
    expect(listRuleMessages(declaration, readNaming(''))).toStrictEqual([
        { rule: 'banned-word', message: 'typescript functions "actualRoot": "actual" is banned (tests group).' },
    ]);
    expect(
        listRuleMessages(declaration, { ...readNaming('[naming]\nbanned_words = ["actual"]\n'), isTestFile: true }),
    ).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "actualRoot": "actual" is banned (naming.banned_words).',
        },
    ]);
});

test('a banned word matches whole words and runs of words only', () => {
    const naming = readNaming(BANNED_WORD_TABLES);
    expect(listRuleMessages(buildIdentifier({ name: 'widgetPrice' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "widgetPrice": "widget" is banned (naming.banned_words).',
        },
    ]);
    expect(validateIdentifier(buildIdentifier({ name: 'subwidget' }), naming)).toStrictEqual([]);
    expect(listRuleMessages(buildIdentifier({ name: 'aPaperTrail' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "aPaperTrail": "paper trail" is banned (naming.banned_words).',
        },
    ]);
    expect(validateIdentifier(buildIdentifier({ name: 'paperOfTrail' }), naming)).toStrictEqual([]);
    expect(listRuleMessages(buildIdentifier({ name: 'crossCuttingRule' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "crossCuttingRule": "cross-cutting" is banned (naming.banned_words).',
        },
    ]);
});

test.each([...LINTER_LIMIT_CASES])(
    '$language $category with a 41-letter name reports $expected, and with too many words reports $wordy',
    ({ language, category, expected, wordy }) => {
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
        ).toStrictEqual([...wordy]);
    },
);
test('an ignored_prefix override strips handle from function and method names in its files', () => {
    const naming = readNaming(HANDLE_PREFIX_TABLES);
    expect(validateIdentifier(buildIdentifier({ name: 'handleSubmit', category: 'functions' }), naming)).toStrictEqual(
        [],
    );
    expect(validateIdentifier(buildIdentifier({ name: 'handleSubmit', category: 'methods' }), naming)).toStrictEqual(
        [],
    );
    expect(listRuleMessages(buildIdentifier({ name: 'handleSubmit', category: 'variables' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript variables "handleSubmit": "handle" is banned (naming.banned_words).',
        },
    ]);
    expect(listRuleMessages(buildIdentifier({ name: 'HandleSubmit' }), naming)).toStrictEqual([
        { rule: 'case', message: 'typescript functions "HandleSubmit": expected camel case.' },
        {
            rule: 'banned-word',
            message: 'typescript functions "HandleSubmit": "handle" is banned (naming.banned_words).',
        },
    ]);
});

/** Read the naming context of a root file from the shipped settings and these gspot.toml tables. */
function readNaming(tables: string): FileNaming {
    return buildFileNaming(
        buildScopeNamingSettings(
            buildSandboxSettings(['typescript', 'python', 'bash', 'naming'], { rules: true, tables }),
        ),
    );
}

/** List the rule and message of each finding of one name. */
function listRuleMessages(identifier: Identifier, naming: FileNaming): { rule: string | undefined; message: string }[] {
    return validateIdentifier(identifier, naming).map(({ rule, message }) => ({ rule, message }));
}
