import { resolve } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { sarifFindings } from '#cli/checks/security/codeql.ts';

const sourceRoot = resolve('selected-source');

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
        const findings = sarifFindings(log, 'security/codeql', accepted, sourceRoot);
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
    expect(() => sarifFindings(value, 'security/codeql', [], sourceRoot)).toThrow();
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
