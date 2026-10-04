import { pathToFileURL } from 'node:url';
import { sep, resolve } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { sarifFindings } from '#cli/checks/general/security/codeql.ts';
import { CODEQL_REPORT } from '#tests/config/cli/checks/general/security/codeql.ts';

const sourceRoot = resolve('selected-source');
const sourceUri = pathToFileURL(`${sourceRoot}${sep}`).href;

describe('sarifFindings', () => {
    test('every result is a finding at its file and line', () => {
        const findings = sarifFindings(CODEQL_REPORT, 'security/codeql', [], sourceRoot);
        expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
            ['api/src/users.ts', 12, 'js/sql-injection'],
            ['scripts/build.ts', 1, 'js/path-injection'],
        ]);
    });

    test('an accepted result leaves only when the rule and the path both match', () => {
        const accepted = [
            { rule: 'js/path-injection', paths: ['scripts/**'], reason: 'Build scripts take no outside input.' },
            { rule: 'js/sql-injection', paths: ['scripts/**'], reason: 'The wrong place for this rule.' },
        ];
        const findings = sarifFindings(CODEQL_REPORT, 'security/codeql', accepted, sourceRoot);
        expect(findings.map((finding) => finding.rule)).toStrictEqual(['js/sql-injection']);
    });
});

test.each([
    {},
    { version: '2.1.0' },
    { version: '2.1.0', runs: [] },
    { version: '2.1.0', runs: [{}] },
    { version: '2.1.0', runs: [{ results: null }] },
])('an incomplete CodeQL report cannot become a clean result: %j', (value) => {
    expect(() => sarifFindings(value, 'security/codeql', [], sourceRoot)).toThrow('runs');
});

test('a valid CodeQL report with no results remains clean', () => {
    expect(
        sarifFindings({ version: '2.1.0', runs: [{ results: [] }] }, 'security/codeql', [], sourceRoot),
    ).toStrictEqual([]);
});

test.each([
    { executionSuccessful: false },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] },
])('CodeQL invocation failures cannot become clean results: %j', (invocation) => {
    expect(() =>
        sarifFindings(
            { version: '2.1.0', runs: [{ results: [], invocations: [invocation] }] },
            'security/codeql',
            [],
            sourceRoot,
        ),
    ).toThrow('unsuccessful analysis');
});

test.each([
    { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' },
    { uri: new URL('api/some%20file.ts', sourceUri).href },
    { uri: 'some%20file.ts', uriBaseId: 'API' },
    { index: 0 },
])('CodeQL resolves source locations before applying path-specific exceptions: %j', (artifact) => {
    const report = {
        version: '2.1.0',
        runs: [
            {
                originalUriBaseIds: {
                    ROOT: { uri: sourceUri },
                    API: { uri: 'api/', uriBaseId: 'ROOT' },
                },
                artifacts: [{ location: { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' } }],
                results: [
                    {
                        ruleId: 'js/sql-injection',
                        message: { text: 'Test injection' },
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: artifact,
                                    region: { startLine: 9, startColumn: 4 },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
    expect(sarifFindings(report, 'security/codeql', [], sourceRoot)).toMatchObject([
        { file: 'api/some file.ts', line: 9, column: 4, rule: 'js/sql-injection' },
    ]);
    expect(
        sarifFindings(
            report,
            'security/codeql',
            [{ rule: 'js/sql-injection', paths: ['api/some file.ts'], reason: 'Reviewed fixture' }],
            sourceRoot,
        ),
    ).toStrictEqual([]);
});

test.each([
    { uri: '../outside.ts' },
    { uri: pathToFileURL(resolve(sourceRoot, '../outside.ts')).href },
    { uri: 'https://example.com/file.ts' },
    { uri: 'file.ts', uriBaseId: 'missing' },
    { index: 1 },
])('CodeQL refuses unresolved or external report locations: %j', (artifact) => {
    const report = {
        version: '2.1.0',
        runs: [{ results: [{ locations: [{ physicalLocation: { artifactLocation: artifact } }] }] }],
    };
    expect(() => sarifFindings(report, 'security/codeql', [], sourceRoot)).toThrow('CodeQL reported');
});

test.each(['utf16CodeUnits', 'unicodeCodePoints'] as const)(
    'CodeQL character offsets preserve declared newlines and %s columns',
    async (columnKind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'unicode.py': '\uFEFFfirst\r\n😀x = unsafe\n' });
        const report = {
            version: '2.1.0',
            runs: [
                {
                    columnKind,
                    newlineSequences: ['\r\n', '\n'],
                    results: [
                        {
                            ruleId: 'py/unsafe',
                            locations: [
                                {
                                    physicalLocation: {
                                        artifactLocation: { uri: 'unicode.py' },
                                        region: { charOffset: 12 },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        expect(sarifFindings(report, 'security/codeql', [], directory.path)).toMatchObject([
            { file: 'unicode.py', line: 2, column: columnKind === 'utf16CodeUnits' ? 7 : 6 },
        ]);
    },
);

test('CodeQL rejects cyclic URI bases before resolving a finding', () => {
    const report = {
        version: '2.1.0',
        runs: [
            {
                originalUriBaseIds: { FIRST: { uriBaseId: 'SECOND' }, SECOND: { uriBaseId: 'FIRST' } },
                results: [
                    {
                        locations: [
                            { physicalLocation: { artifactLocation: { uri: 'source.ts', uriBaseId: 'FIRST' } } },
                        ],
                    },
                ],
            },
        ],
    };
    expect(() => sarifFindings(report, 'security/codeql', [], sourceRoot)).toThrow(
        'CodeQL reported a cyclic source location.',
    );
});

test.each([
    { artifact: {}, offset: 1, message: 'CodeQL reported a character offset without a source file.' },
    {
        artifact: { uri: 'source.py' },
        offset: 4,
        message: 'CodeQL reported a character offset beyond the source file.',
    },
])('CodeQL rejects invalid character locations: $message', async ({ artifact, offset, message: diagnostic }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'source.py': 'abc' });
    const report = {
        version: '2.1.0',
        runs: [
            {
                results: [
                    {
                        locations: [
                            { physicalLocation: { artifactLocation: artifact, region: { charOffset: offset } } },
                        ],
                    },
                ],
            },
        ],
    };
    expect(() => sarifFindings(report, 'security/codeql', [], directory.path)).toThrow(diagnostic);
});

test('CodeQL uses artifact encoding and gives explicit lines precedence over character offsets', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'source.py': Buffer.from('first\n😀x', 'utf16le') });
    const report = {
        version: '2.1.0',
        runs: [
            {
                defaultEncoding: 'utf8',
                columnKind: 'unicodeCodePoints',
                artifacts: [{ location: { uri: 'source.py' }, encoding: 'utf-16le' }],
                results: [
                    {
                        locations: [
                            { physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 7 } } },
                        ],
                    },
                    {
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: { index: 0 },
                                    region: { charOffset: 100, startLine: 3, startColumn: 2 },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
    expect(
        sarifFindings(report, 'security/codeql', [], directory.path).map(({ file, line, column }) => ({
            file,
            line,
            column,
        })),
    ).toStrictEqual([
        { file: 'source.py', line: 2, column: 2 },
        { file: 'source.py', line: 3, column: 2 },
    ]);
});

test('CodeQL uses the first source line when a character offset is negative', () => {
    const report = {
        version: '2.1.0',
        runs: [
            {
                results: [
                    {
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: { uri: 'source.py' },
                                    region: { charOffset: -1 },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
    expect(
        sarifFindings(report, 'security/codeql', [], sourceRoot).map(({ file, line, column }) => ({
            file,
            line,
            column,
        })),
    ).toStrictEqual([{ file: 'source.py', line: 1, column: undefined }]);
});

test('CodeQL retains a repository-level finding when the result has no source location', () => {
    const report = { version: '2.1.0', runs: [{ results: [{}] }] };
    expect(
        sarifFindings(report, 'security/codeql', [], sourceRoot).map(({ file, line, column }) => ({
            file,
            line,
            column,
        })),
    ).toStrictEqual([{ file: '', line: 1, column: undefined }]);
});
