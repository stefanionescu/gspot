import { expect, test } from 'bun:test';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { parseJsonFindings } from '#cli/engine/outputs/json.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';
import type { CheckStop } from '#cli/system/errors.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import {
    EMPTY_JSON_CASES,
    FIX_FIELD_CASES,
    FLAT_JSON_FINDINGS,
    INVALID_FINDING_REPORTS,
    NESTED_LIST_FORMAT,
    NESTED_LIST_OUTPUT,
    TWO_LEVEL_FORMAT,
} from '#tests/config/engine/outputs.ts';
import { matchFields } from '#tests/setup/matchers.ts';

function parseJsonReport(checkId: string, output: unknown, stdout: string): Finding[] {
    return parseJsonFindings({
        check: checkId,
        output: outputSchema.parse(output),
        stdout,
        text: stdout,
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

test('a nested list reads the file from the outer object and the rest from each nested object', () => {
    const stdout = `noise\n${JSON.stringify({
        files: [{ filepath: 'a.sql', violations: [{ start_line_no: 3, code: 'LT01', description: 'Spacing.' }] }],
    })}`;
    const [finding] = parseJsonReport('sql/sqlfluff', NESTED_LIST_FORMAT, stdout);
    expect([finding?.file, finding?.line, finding?.rule]).toStrictEqual(['a.sql', 3, 'LT01']);
});

test('an outer object without its nested list has no findings, as Trivy reports a clean file', () => {
    const stdout = JSON.stringify({ files: [{ filepath: 'clean.sql' }] });
    expect(parseJsonReport('sql/sqlfluff', NESTED_LIST_FORMAT, stdout)).toStrictEqual([]);
});

test.each([
    ['safe', true],
    ['unsafe', false],
    ['display-only', false],
])('a JSON finding with a %s fix is fixable: %s', (applicability, expected) => {
    const output = {
        format: 'json' as const,
        fields: { file: 'filename', message: 'message', fixable: 'fix.applicability' },
    };
    const stdout = JSON.stringify([{ filename: '/repo/a.py', message: 'A message.', fix: { applicability } }]);
    const check = { runs: 'files' as const, id: 'python/ruff', output, fix: ['ruff'] };
    expect(parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' })).toMatchObject([{ fixable: expected }]);
});

test.each([...FIX_FIELD_CASES])(
    'a JSON finding is fixable only when the check has a fix command: %s fix field',
    (name, fields, expected) => {
        const output = {
            format: 'json' as const,
            children: ['messages'],
            fields: { file: 'filePath', message: 'message', fixable: 'fix' },
        };
        const stdout = JSON.stringify([{ filePath: '/repo/a.js', messages: [{ message: name, ...fields }] }]);
        const check = {
            runs: 'files' as const,
            id: 'javascript/eslint',
            output,
            fix: ['formatter'],
        };
        const findings = parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' });
        expect(findings).toMatchObject([{ file: 'a.js', fixable: expected }]);
        expect(
            parseOutput({ runs: check.runs, id: check.id, output }, stdout, '', {
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
    const [finding] = parseJsonReport('dependencies/osv-scanner', TWO_LEVEL_FORMAT, stdout);
    expect([finding?.file, finding?.rule, finding?.message]).toStrictEqual([
        'bun.lock',
        'GHSA-1',
        'qs: 6.15.3: Denial of service.',
    ]);
});

test.each([...EMPTY_JSON_CASES])('an invalid JSON report is refused: %s', (stdout, start) => {
    expect(() => parseJsonReport('x/y', { format: 'json', list: 'items' }, stdout)).toThrow(
        matchFields<CheckStop>({
            name: 'CheckStop',
            status: 'error',
            message: expect.stringContaining(start) as string,
        }),
    );
});

test.each([...INVALID_FINDING_REPORTS])('a JSON report with $name is refused', ({ output, stdout }) => {
    expect(() => parseJsonReport('x/y', output, stdout)).toThrow(
        matchFields<CheckStop>({ name: 'CheckStop', status: 'error' }),
    );
});
