import { expect, test } from 'bun:test';

import { validateIdentifiers } from '#cli/configurations/general/naming/checks/validation.ts';
import type { FileNaming, Identifier, NamingSettings } from '#cli/types/configurations/general.ts';
import {
    ALLOWED_NAME_TABLES,
    HANDLE_PREFIX_TABLES,
    HANDLE_ROUTE_IDENTIFIER,
    HOOK_PREFIX_TABLES,
    NAME_WORDS,
    NAMING_LIMIT_CASES,
} from '#tests/config/configurations/naming/validation.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

async function readNaming(tables: string): Promise<FileNaming> {
    return buildFileNaming(
        await buildScopeNamingSettings(
            buildSandboxSettings(['typescript', 'python', 'bash', 'naming'], { rules: true, tables }),
        ),
    );
}

function listRules(identifier: Identifier, naming: FileNaming): Array<string | undefined> {
    return validateIdentifiers({ ...naming.settings, isTestFile: () => naming.isTestFile }, [identifier]).map(
        ({ rule }) => rule,
    );
}
function buildFileNaming(settings: NamingSettings): FileNaming {
    return { settings, isTestFile: false };
}
function buildIdentifier(fields: Pick<Identifier, 'name'> & Partial<Identifier>): Identifier {
    const { file = 'src/a.ts', language = 'typescript', category = 'functions', line = 1, column = 1 } = fields;
    return { file, language, category, line, column, ...fields };
}

test.each([...NAMING_LIMIT_CASES])(
    '$language accepts its exact limits and reports the next character or word',
    async ({ language, category, characters, words }) => {
        const naming = await buildScopeNamingSettings(
            buildSandboxSettings(['naming'], {
                rules: true,
                tables: `[naming.${language}]\nmax_characters = ${String(characters)}\nmax_words = ${String(words)}\n`,
            }),
        );
        const context = buildFileNaming(naming);
        const declaration = buildIdentifier({
            file: 'source',
            language,
            category,
            name: 'z'.repeat(characters),
            line: 1,
            column: 1,
        });
        expect(listRules(declaration, context)).toStrictEqual([]);
        expect(listRules({ ...declaration, name: 'z'.repeat(characters + 1) }, context)).toStrictEqual(['length']);
        const separator = ['python', 'bash', 'sql'].includes(language) ? '_' : '';
        const casedWords = NAME_WORDS.map((word, index) =>
            separator === '' && index > 0 ? word.slice(0, 1).toUpperCase() + word.slice(1) : word,
        );
        expect(listRules({ ...declaration, name: casedWords.slice(0, words).join(separator) }, context)).toStrictEqual(
            [],
        );
        expect(
            listRules({ ...declaration, name: casedWords.slice(0, words + 1).join(separator) }, context),
        ).toStrictEqual(['words']);
    },
);

test('the JavaScript handle override and a repository use override strip their prefixes only in their own files and languages', async () => {
    const naming = await readNaming(HOOK_PREFIX_TABLES);
    const declaration = buildIdentifier(HANDLE_ROUTE_IDENTIFIER);
    expect(listRules(declaration, naming)).toStrictEqual([]);
    expect(listRules({ ...declaration, file: 'src/hooks/login.ts', name: 'useLogin' }, naming)).toStrictEqual([]);
    expect(listRules({ ...declaration, file: 'src/routes/login.ts', name: 'useLogin' }, naming)).toStrictEqual([
        'banned-word',
    ]);
    expect(
        listRules({ ...declaration, file: 'src/app.py', language: 'python', name: 'handle_login' }, naming),
    ).toStrictEqual(['banned-word']);
});

test.each([
    ['userID', 'variables', 'case'],
    ['HTTPServer', 'classes', 'case'],
    ['processOrder', 'functions', 'banned-word'],
    ['isNotReady', 'variables', 'banned-word'],
] as const)('%s, a %s, reports %s', async (name, category, rule) => {
    expect(listRules(buildIdentifier({ name, category }), await readNaming(''))).toStrictEqual([rule]);
});

test.each([
    ['runToolProcess', 'functions'],
    ['processOrder', 'variables'],
    ['isNotable', 'variables'],
    ['userId', 'variables'],
    ['pointA', 'variables'],
    ['awsS3BucketVersioning', 'variables'],
    ['S3Bucket', 'classes'],
] as const)('%s, a %s, passes', async (name, category) => {
    expect(listRules(buildIdentifier({ name, category }), await readNaming(''))).toStrictEqual([]);
});

test('a Swift name keeps its acronym', async () => {
    const identifier = buildIdentifier({
        name: 'avatarURL',
        category: 'functions',
        language: 'swift',
        file: 'a.swift',
    });
    expect(listRules(identifier, await readNaming(''))).toStrictEqual([]);
});

test('a number word such as base64 counts as one word', async () => {
    const naming = await buildScopeNamingSettings(buildSandboxSettings(['naming'], { rules: true }));
    const context = buildFileNaming({ ...naming, limitLookup: () => ({ cases: [], maxCharacters: 35, maxWords: 4 }) });
    const declaration = buildIdentifier({ name: 'base64User', category: 'variables', file: 'source.ts' });
    expect(listRules(declaration, context)).toStrictEqual([]);
});

test('a name that breaks all five naming limits gets five findings, and the banned-word message names its word list', async () => {
    const { settings } = await readNaming('');
    const findings = validateIdentifiers({ ...settings, isTestFile: () => false }, [
        buildIdentifier({ name: 'helperValue2UserUserWithMoreWordsHere' }),
    ]);
    expect(findings.map(({ rule }) => rule)).toStrictEqual([
        'digits',
        'length',
        'words',
        'duplicate-words',
        'banned-word',
    ]);
    expect(findings.at(-1)?.message).toContain('roles list');
});

test('case follows the category, and each dot-separated piece of a file name is checked alone', async () => {
    const naming = await readNaming('');
    expect(listRules(buildIdentifier({ name: 'my_type', category: 'types' }), naming)).toStrictEqual(['case']);
    expect(listRules(buildIdentifier({ name: 'bash.test', category: 'files' }), naming)).toStrictEqual([]);
});

test('an allow_digits exception accepts a digit only under its paths', async () => {
    const naming = await readNaming(`[[naming.exception]]
paths = ["tests/acceptance/**"]
allow_digits = true
reason = "Acceptance tests number their steps."
`);
    expect(
        listRules(buildIdentifier({ name: 'user2', category: 'variables', file: 'tests/acceptance/a.ts' }), naming),
    ).toStrictEqual([]);
    expect(
        listRules(buildIdentifier({ name: 'user2', category: 'variables', file: 'src/a.ts' }), naming),
    ).toStrictEqual(['digits']);
});

test.each([
    ['corsHeaders', []],
    ['coreCount', ['banned-word']],
    ['cores', ['banned-word']],
    ['cored', ['banned-word']],
] as const)('cors stays a domain word while core and its word forms remain banned: %s', async (name, rules) => {
    expect(listRules(buildIdentifier({ name, category: 'variables' }), await readNaming(''))).toStrictEqual([...rules]);
});

test('allowed names and path overrides skip the naming rules', async () => {
    const naming = await readNaming(ALLOWED_NAME_TABLES);
    expect(listRules(buildIdentifier({ name: 'requestAnimationFrame' }), naming)).toStrictEqual([]);
    expect(
        listRules(buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/route.ts' }), naming),
    ).toStrictEqual([]);
    expect(
        listRules(buildIdentifier({ name: 'Content-Type', category: 'properties', file: 'api/internal.ts' }), naming),
    ).toStrictEqual(['case']);
});

test('a word of the shipped tests list passes in a test file, and the same word from banned_words is reported there', async () => {
    const declaration = buildIdentifier({ name: 'actualRoot' });
    expect(listRules(declaration, { ...(await readNaming('')), isTestFile: true })).toStrictEqual([]);
    expect(listRules(declaration, await readNaming(''))).toStrictEqual(['banned-word']);
    expect(
        listRules(declaration, {
            ...(await readNaming('[naming]\nbanned_words = ["actual"]\n')),
            isTestFile: true,
        }),
    ).toStrictEqual(['banned-word']);
});

test('a banned word matches a word or a run of words, never the inside of a word', async () => {
    const naming = await readNaming('[naming]\nbanned_words = ["widget", "paper trail", "cross-cutting"]\n');
    expect(listRules(buildIdentifier({ name: 'widgetPrice' }), naming)).toStrictEqual(['banned-word']);
    expect(listRules(buildIdentifier({ name: 'subwidget' }), naming)).toStrictEqual([]);
    expect(listRules(buildIdentifier({ name: 'aPaperTrail' }), naming)).toStrictEqual(['banned-word']);
    expect(listRules(buildIdentifier({ name: 'paperOfTrail' }), naming)).toStrictEqual([]);
    expect(listRules(buildIdentifier({ name: 'crossCuttingRule' }), naming)).toStrictEqual(['banned-word']);
});

test('an ignored_prefix override strips handle from function and method names in its files', async () => {
    const naming = await readNaming(HANDLE_PREFIX_TABLES);
    expect(listRules(buildIdentifier({ name: 'handleSubmit', category: 'functions' }), naming)).toStrictEqual([]);
    expect(listRules(buildIdentifier({ name: 'handleSubmit', category: 'methods' }), naming)).toStrictEqual([]);
    expect(listRules(buildIdentifier({ name: 'handleSubmit', category: 'variables' }), naming)).toStrictEqual([
        'banned-word',
    ]);
    expect(listRules(buildIdentifier({ name: 'HandleSubmit' }), naming)).toStrictEqual(['case', 'banned-word']);
});
