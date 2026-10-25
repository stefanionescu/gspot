import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import { validateIdentifier } from '#cli/checks/general/naming/rules.ts';
import { type FileNaming, type Identifier, type NamingSettings } from '#cli/types/checks/general/naming.ts';

import {
    NAME_WORDS,
    NAMING_LIMIT_CASES,
    LINTER_LIMIT_CASES,
    HOOK_PREFIX_TABLES,
    ALLOWED_NAME_TABLES,
    HANDLE_PREFIX_TABLES,
    OVERLONG_NAME_FINDINGS,
    HANDLE_ROUTE_IDENTIFIER,
} from '#tests/config/checks/general/naming/rules.ts';

test.each([...NAMING_LIMIT_CASES])(
    '$language accepts its exact limits and reports the next character or word',
    ({ language, category, characters, words }) => {
        const naming = buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
        const context = buildFileNaming(naming);
        const declaration = buildIdentifier({
            file: 'source',
            language,
            category,
            label: category,
            name: 'z'.repeat(characters),
            line: 1,
            column: 1,
        });
        expect(listRuleMessages(declaration, context)).toStrictEqual([]);
        expect(listRuleMessages({ ...declaration, name: 'z'.repeat(characters + 1) }, context)).toStrictEqual([
            {
                rule: 'length',
                message: `${category} "${'z'.repeat(characters + 1)}": ${String(characters + 1)} characters is over the limit of ${String(characters)}.`,
            },
        ]);
        const separator = ['python', 'bash', 'sql'].includes(language) ? '_' : '';
        const casedWords = NAME_WORDS.map((word, index) =>
            separator === '' && index > 0 ? word.slice(0, 1).toUpperCase() + word.slice(1) : word,
        );
        expect(
            listRuleMessages({ ...declaration, name: casedWords.slice(0, words).join(separator) }, context),
        ).toStrictEqual([]);
        expect(
            listRuleMessages({ ...declaration, name: casedWords.slice(0, words + 1).join(separator) }, context),
        ).toStrictEqual([
            {
                rule: 'words',
                message: `${category} "${casedWords.slice(0, words + 1).join(separator)}": ${String(words + 1)} words is over the limit of ${String(words)}.`,
            },
        ]);
    },
);

test('the JavaScript handle override and a repository use override strip their prefixes only in their own files and languages', () => {
    const naming = readNaming(HOOK_PREFIX_TABLES);
    const declaration = buildIdentifier(HANDLE_ROUTE_IDENTIFIER);
    expect(listRuleMessages(declaration, naming)).toStrictEqual([]);
    expect(listRuleMessages({ ...declaration, file: 'src/hooks/login.ts', name: 'useLogin' }, naming)).toStrictEqual(
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
    const naming = buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
    const context = buildFileNaming({ ...naming, limitsFor: () => ({ caseNames: [], maxChars: 35, maxWords: 4 }) });
    const declaration = buildIdentifier({ name: 'base64User', category: 'variables', file: 'source.ts' });
    expect(listRuleMessages(declaration, context)).toStrictEqual([]);
    expect(listRuleMessages({ ...declaration, name: 'base64UserUser' }, context)).toStrictEqual([
        { rule: 'duplicate-words', message: 'typescript variables "base64UserUser": "user" repeats.' },
    ]);
    expect(listRuleMessages({ ...declaration, name: 'base64FirstSecondThirdFourth' }, context)).toStrictEqual([
        {
            rule: 'words',
            message: 'typescript variables "base64FirstSecondThirdFourth": 5 words is over the limit of 4.',
        },
    ]);
    expect(listRuleMessages({ ...declaration, name: 'base64Helper' }, context)).toStrictEqual([
        { rule: 'banned-word', message: 'typescript variables "base64Helper": "helper" is banned (roles group).' },
    ]);
    expect(listRuleMessages({ ...declaration, name: 'user2' }, context)).toStrictEqual([
        { rule: 'digits', message: 'typescript variables "user2": a digit is not a word.' },
    ]);
});

test('a name with a digit, too many characters and words, a repeated word, and a banned word gets all five findings, and the banned-word message names its group', () => {
    const OVERLONG_NAME = 'helperValue2UserUserWithMoreWordsHere';

    expect(listRuleMessages(buildIdentifier({ name: OVERLONG_NAME }), readNaming(''))).toStrictEqual([
        ...OVERLONG_NAME_FINDINGS,
    ]);
});

test('case follows the category, and a file name is checked part by part between dots', () => {
    const naming = readNaming('');
    expect(listRuleMessages(buildIdentifier({ name: 'my_type', category: 'types' }), naming)).toStrictEqual([
        { rule: 'case', message: 'typescript types "my_type": expected pascal case.' },
    ]);
    expect(listRuleMessages(buildIdentifier({ name: 'bash.test', category: 'files' }), naming)).toStrictEqual([]);
});

test('the naming check accepts _ as a variable, a digit in a tests/ path, and a Bash name with an ignored prefix', () => {
    const ACCEPTANCE_DIGIT_TABLES = `[[naming.override]]
paths = ["tests/acceptance/**"]
allow_digits = true
reason = "Acceptance fixtures number their steps."
`;

    const naming = readNaming(ACCEPTANCE_DIGIT_TABLES);
    expect(listRuleMessages(buildIdentifier({ name: '_', category: 'variables' }), naming)).toStrictEqual([]);
    expect(
        listRuleMessages(
            buildIdentifier({ name: 'user2', category: 'variables', file: 'tests/acceptance/a.ts' }),
            naming,
        ),
    ).toStrictEqual([]);
    expect(
        listRuleMessages(
            buildIdentifier({ name: '_private_step', category: 'functions', file: 'scripts/a.sh', language: 'bash' }),
            naming,
        ),
    ).toStrictEqual([]);
});

test('allowed names and path overrides skip the naming rules', () => {
    const naming = readNaming(ALLOWED_NAME_TABLES);
    expect(listRuleMessages(buildIdentifier({ name: 'requestAnimationFrame' }), naming)).toStrictEqual([]);
    expect(
        listRuleMessages(
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

test('a word of the shipped tests group passes in a test file, and the same word from banned_words is reported there', () => {
    const declaration = buildIdentifier({ name: 'actualRoot' });
    expect(listRuleMessages(declaration, { ...readNaming(''), isTestFile: true })).toStrictEqual([]);
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
    const BANNED_WORD_TABLES = '[naming]\nbanned_words = ["widget", "paper trail", "cross-cutting"]\n';

    const naming = readNaming(BANNED_WORD_TABLES);
    expect(listRuleMessages(buildIdentifier({ name: 'widgetPrice' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "widgetPrice": "widget" is banned (naming.banned_words).',
        },
    ]);
    expect(listRuleMessages(buildIdentifier({ name: 'subwidget' }), naming)).toStrictEqual([]);
    expect(listRuleMessages(buildIdentifier({ name: 'aPaperTrail' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "aPaperTrail": "paper trail" is banned (naming.banned_words).',
        },
    ]);
    expect(listRuleMessages(buildIdentifier({ name: 'paperOfTrail' }), naming)).toStrictEqual([]);
    expect(listRuleMessages(buildIdentifier({ name: 'crossCuttingRule' }), naming)).toStrictEqual([
        {
            rule: 'banned-word',
            message: 'typescript functions "crossCuttingRule": "cross-cutting" is banned (naming.banned_words).',
        },
    ]);
});

test.each([...LINTER_LIMIT_CASES])(
    '$language $category enforces its length, case and word limits',
    ({ language, category, expected, wordy }) => {
        const UPPER_SNAKE_OVERRIDE = `[[naming.override]]
paths = ["source"]
cases = ["upper-snake"]
reason = "The authored interface selects this case."
`;

        const naming = buildScopeNamingSettings(
            buildSandboxSettings(['naming'], {
                rules: true,
                level: 'all',
                tables: UPPER_SNAKE_OVERRIDE,
            }),
        );
        const context = buildFileNaming(naming);
        const identifier = buildIdentifier({
            file: 'source',
            language,
            category,
            label: category,
            name: 'a'.repeat(41),
            line: 1,
            column: 1,
        });
        expect(listRuleMessages(identifier, context)).toStrictEqual([...expected]);
        expect(listRuleMessages({ ...identifier, name: NAME_WORDS.join('_') }, context)).toStrictEqual([...wordy]);
    },
);

test('an ignored_prefix override strips handle from function and method names in its files', () => {
    const naming = readNaming(HANDLE_PREFIX_TABLES);
    expect(listRuleMessages(buildIdentifier({ name: 'handleSubmit', category: 'functions' }), naming)).toStrictEqual(
        [],
    );
    expect(listRuleMessages(buildIdentifier({ name: 'handleSubmit', category: 'methods' }), naming)).toStrictEqual([]);
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 11 calls in this file share it.
function readNaming(tables: string): FileNaming {
    return buildFileNaming(
        buildScopeNamingSettings(
            buildSandboxSettings(['typescript', 'python', 'bash', 'naming'], { rules: true, tables }),
        ),
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function listRuleMessages(identifier: Identifier, naming: FileNaming): { rule: string | undefined; message: string }[] {
    return validateIdentifier(identifier, naming).map(({ rule, message }) => ({ rule, message }));
}
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function buildFileNaming(settings: NamingSettings): FileNaming {
    return { check: getShippedCheck('naming/identifiers'), settings, isTestFile: false };
}
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function buildIdentifier(fields: Pick<Identifier, 'name'> & Partial<Identifier>): Identifier {
    const { file = 'src/a.ts', language = 'typescript', category = 'functions', line = 1, column = 1 } = fields;
    return { file, language, category, line, column, label: `${language} ${category}`, ...fields };
}
