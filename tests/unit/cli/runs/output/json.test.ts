import { test, expect } from 'bun:test';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { parseJsonFindings } from '#cli/runs/output/json.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';

import {
    FIX_FIELD_CASES,
    TWO_LEVEL_FORMAT,
    EMPTY_JSON_CASES,
    FLAT_JSON_FINDINGS,
    NESTED_LIST_FORMAT,
    NESTED_LIST_OUTPUT,
    INVALID_FINDING_REPORTS,
} from '#tests/data/runs/output/json.ts';

/** Parse a JSON report with the paths and help text that these cases share. */
function parseJsonReport(check: string, output: unknown, stdout: string): Finding[] {
    return parseJsonFindings({
        check,
        output: outputSchema.parse(output),
        stdout,
        text: stdout,
        help: 'help',
        root: process.cwd(),
        cwd: process.cwd(),
    });
}

test('a flat JSON list maps its fields to a finding', () => {
    const stdout = JSON.stringify([{ path: 'nginx.conf', line: 9, plugin: 'ssrf', summary: 'Possible SSRF.' }]);
    const output = {
        format: 'json' as const,
        fields: { file: 'path', line: 'line', rule: 'plugin', message: 'summary' },
    };
    expect(parseJsonReport('nginx/gixy', output, stdout)).toStrictEqual([...FLAT_JSON_FINDINGS]);
});

test('a nested list reads the file from the item and the rest from the child', () => {
    const stdout = `noise\n${JSON.stringify({
        files: [{ filepath: 'a.sql', violations: [{ start_line_no: 3, code: 'LT01', description: 'Spacing.' }] }],
    })}`;
    const output = NESTED_LIST_FORMAT;
    const [finding] = parseJsonReport('sql/sqlfluff', output, stdout);
    expect([finding?.file, finding?.line, finding?.rule]).toStrictEqual(['a.sql', 3, 'LT01']);
});

test.each([...FIX_FIELD_CASES])(
    'a JSON finding is fixable only when the check has a fix command: %s fix field',
    (name, extra, expected) => {
        const output = {
            format: 'json' as const,
            children: 'messages',
            fields: { file: 'filePath', message: 'message', fixable: 'fix' },
        };
        const stdout = JSON.stringify([{ filePath: '/repo/a.js', messages: [{ message: name, ...extra }] }]);
        const check = {
            runs: 'files' as const,
            id: 'javascript/eslint',
            help: 'Correct the defect.',
            output,
            fix: ['formatter'],
        };
        const findings = parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' });
        expect(findings).toMatchObject([{ file: 'a.js', fixable: expected }]);
        expect(
            parseOutput({ runs: check.runs, id: check.id, help: check.help, output }, stdout, '', {
                root: '/repo',
                cwd: '/repo',
            }),
        ).toMatchObject([{ fixable: false }]);
    },
);

test('a tool that counts lines from zero names its line base', () => {
    const stdout = JSON.stringify([{ file: 'a.sql', line: 0, column: 18, rule_name: 'r', message: 'm' }]);
    const output = {
        format: 'json' as const,
        line_base: 0 as const,
        fields: { file: 'file', line: 'line', column: 'column', rule: 'rule_name', message: 'message' },
    };
    const [finding] = parseJsonReport('postgres/squawk', output, stdout);
    expect([finding?.line, finding?.column]).toStrictEqual([1, 19]);
});

test('lists nested two levels down read the file from the top and join several message paths', () => {
    const stdout = JSON.stringify(NESTED_LIST_OUTPUT);
    const output = TWO_LEVEL_FORMAT;
    const [finding] = parseJsonReport('dependencies/osv-scanner', output, stdout);
    expect([finding?.file, finding?.rule, finding?.message]).toStrictEqual([
        'bun.lock',
        'GHSA-1',
        'qs 6.15.3 Denial of service.',
    ]);
});

test.each([...EMPTY_JSON_CASES])('an invalid JSON report is refused: %s', (stdout, message) => {
    expect(() => parseJsonReport('x/y', { format: 'json', items: 'items' }, stdout)).toThrow(new Error(message));
});

test('an empty JSON report has no findings', () => {
    expect(parseJsonReport('x/y', { format: 'json' }, '[]')).toStrictEqual([]);
});

test.each([...INVALID_FINDING_REPORTS])(
    'a JSON report with $name is refused with its message',
    ({ output, stdout, message }) => {
        expect(() => parseJsonReport('x/y', output, stdout)).toThrow(new Error(message));
    },
);
