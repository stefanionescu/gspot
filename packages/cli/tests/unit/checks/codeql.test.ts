import { describe, expect, test } from 'bun:test';
import type { SarifLog } from '#types/integrity.ts';
import { sarifFindings } from '#cli/checks/security/codeql.ts';

const log: SarifLog = {
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
        const findings = sarifFindings(log, 'security/codeql', []);
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
        const findings = sarifFindings(log, 'security/codeql', accepted);
        expect(findings.map((finding) => finding.rule)).toEqual(['js/sql-injection']);
    });
});
