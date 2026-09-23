import { testdir, createFileTree } from 'testdirs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { sarifFindings } from '#cli/checks/security/codeql.ts';

const sourceRoot = resolve('selected-source');
const sourceUri = pathToFileURL(`${sourceRoot}${sep}`).href;

const log = {
    version: '2.1.0',
    runs: [
        {
            results: [
                {
                    ruleId: 'js/sql-injection',
                    message: { text: 'This query depends on a user-provided value.' },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: 'api/src/users.ts' },
                                region: { startLine: 12 },
                            },
                        },
                    ],
                },
                {
                    ruleId: 'js/path-injection',
                    message: { text: 'This path depends on a user-provided value.' },
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'scripts/build.ts' } } }],
                },
            ],
        },
    ],
};

describe('sarifFindings', () => {
    test('every result is a finding at its file and line', () => {
        const findings = sarifFindings(log, 'security/codeql', [], sourceRoot);
        expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toEqual([
            ['api/src/users.ts', 12, 'js/sql-injection'],
            ['scripts/build.ts', 1, 'js/path-injection'],
        ]);
    });

    test('an accepted result leaves only when the rule and the path both match', () => {
        const accepted = [
            { rule: 'js/path-injection', paths: ['scripts/**'], reason: 'Build scripts take no outside input.' },
            { rule: 'js/sql-injection', paths: ['scripts/**'], reason: 'The wrong place for this rule.' },
        ];
        const findings = sarifFindings(log, 'security/codeql', accepted, sourceRoot);
        expect(findings.map((finding) => finding.rule)).toEqual(['js/sql-injection']);
    });
});

test.each([
    {},
    { version: '2.1.0' },
    { version: '2.1.0', runs: [] },
    { version: '2.1.0', runs: [{}] },
    { version: '2.1.0', runs: [{ results: null }] },
])('an incomplete CodeQL report cannot become a clean result: %j', (value) => {
    expect(() => sarifFindings(value, 'security/codeql', [], sourceRoot)).toThrow();
    expect(sarifFindings({ version: '2.1.0', runs: [{ results: [] }] }, 'security/codeql', [], sourceRoot)).toEqual([]);
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
                        message: { text: 'Planted injection' },
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
    ).toEqual([]);
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
    expect(() => sarifFindings(report, 'security/codeql', [], sourceRoot)).toThrow();
});

test.each(['utf16CodeUnits', 'unicodeCodePoints'] as const)(
    'CodeQL character offsets preserve declared newlines and %s columns',
    async (columnKind) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'unicode.py': '\ufefffirst\r\n😀x = unsafe\n' });
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
