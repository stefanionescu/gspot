import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { parseJson } from '#cli/parsers/output/json.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import { parseAlerts } from '#cli/parsers/output/reports.ts';

describe('JSON finding fields', () => {
    test('a flat list maps its fields to a finding', () => {
        const stdout = JSON.stringify([{ path: 'nginx.conf', line: 9, plugin: 'ssrf', summary: 'Possible SSRF.' }]);
        const output = {
            format: 'json' as const,
            fields: { file: 'path', line: 'line', rule: 'plugin', message: 'summary' },
        };
        expect(parseJson('nginx/gixy', output, stdout, 'help')).toStrictEqual([
            {
                check: 'nginx/gixy',
                file: 'nginx.conf',
                line: 9,
                rule: 'ssrf',
                message: 'Possible SSRF.',
                help: 'help',
                fixable: false,
            },
        ]);
    });

    test('a nested list reads the file from the item and the rest from the child', () => {
        const stdout = `noise\n${JSON.stringify({
            files: [{ filepath: 'a.sql', violations: [{ start_line_no: 3, code: 'LT01', description: 'Spacing.' }] }],
        })}`;
        const output = {
            format: 'json' as const,
            items: 'files',
            children: 'violations',
            fields: { file: 'filepath', line: 'start_line_no', rule: 'code', message: 'description' },
        };
        const [finding] = parseJson('sql/sqlfluff', output, stdout, 'help');
        expect([finding?.file, finding?.line, finding?.rule]).toStrictEqual(['a.sql', 3, 'LT01']);
    });
});

test.each([
    ['absent', {}, false],
    ['object', { fix: { range: [0, 1], text: '' } }, true],
    ['null', { fix: null }, true],
    ['false', { fix: false }, true],
] as const)('generic JSON %s fix fields preserve native fix availability', (name, extra, expected) => {
    const output = {
        format: 'json' as const,
        children: 'messages',
        fields: { file: 'filePath', message: 'message', fixable: 'fix' },
    };
    const stdout = JSON.stringify([{ filePath: '/repo/a.js', messages: [{ message: name, ...extra }] }]);
    const check = { name: 'javascript/eslint', help: 'Correct the defect.', output, fix: ['formatter'] };
    const findings = parseOutput(check, stdout, '', { root: '/repo', cwd: '/repo' });
    expect(findings).toMatchObject([{ file: 'a.js', fixable: expected }]);
    expect(
        parseOutput({ name: check.name, help: check.help, output }, stdout, '', { root: '/repo', cwd: '/repo' }),
    ).toMatchObject([{ fixable: false }]);
});

describe('JSON positions and nested records', () => {
    test('a tool that counts lines from zero names its base', () => {
        const stdout = JSON.stringify([{ file: 'a.sql', line: 0, column: 18, rule_name: 'r', message: 'm' }]);
        const output = {
            format: 'json' as const,
            line_base: 0 as const,
            fields: { file: 'file', line: 'line', column: 'column', rule: 'rule_name', message: 'message' },
        };
        const [finding] = parseJson('postgres/squawk', output, stdout, 'help');
        expect([finding?.line, finding?.column]).toStrictEqual([1, 19]);
    });

    test('lists nested two levels down read the file from the top and join several message paths', () => {
        const stdout = JSON.stringify({
            results: [
                {
                    source: { path: 'bun.lock' },
                    packages: [
                        {
                            package: { name: 'qs', version: '6.15.3' },
                            vulnerabilities: [{ id: 'GHSA-1', summary: 'Denial of service.' }],
                        },
                    ],
                },
            ],
        });
        const output = {
            format: 'json' as const,
            items: 'results',
            children: 'packages.vulnerabilities',
            fields: { file: 'source.path', rule: 'id', message: 'package.name package.version summary' },
        };
        const [finding] = parseJson('dependencies/osv', output, stdout, 'help');
        expect([finding?.file, finding?.rule, finding?.message]).toStrictEqual([
            'bun.lock',
            'GHSA-1',
            'qs 6.15.3 Denial of service.',
        ]);
    });
});

describe('JSON report validation', () => {
    test.each([
        ['', 'no JSON report'],
        ['fatal error', 'no JSON report'],
        ['{ broken', 'JSON Parse error'],
        ['{}', 'array items'],
        ['{"items":null}', 'array items'],
    ])('invalid report %s is rejected', (stdout, expected) => {
        expect(() => parseJson('x/y', { format: 'json', items: 'items' }, stdout, 'help')).toThrow(expected);
    });

    test('valid empty reports remain clean and missing nested lists are rejected', () => {
        expect(parseJson('x/y', { format: 'json' }, '[]', 'help')).toStrictEqual([]);
        expect(() => parseJson('x/y', { format: 'json' }, '[null]', 'help')).toThrow('invalid finding object');
        expect(() => parseJson('x/y', { format: 'json', fields: { message: 'message' } }, '[{}]', 'help')).toThrow(
            'mapped message',
        );
        expect(() => parseJson('x/y', { format: 'json', children: 'messages' }, '[{}]', 'help')).toThrow(
            'array messages',
        );
    });
});

describe('vale output', () => {
    test('JSON output parses native source and stdin locations into alerts', () => {
        const alerts = parseAlerts(
            JSON.stringify({
                'docs/a.md': [
                    { Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: "Marketing word 'robust'." },
                ],
                'stdin.rb': [
                    { Line: 2, Span: [5, 6], Check: 'Google.We', Message: 'Try not to use first-person plural.' },
                ],
            }),
        );
        expect(alerts).toStrictEqual([
            { file: 'docs/a.md', line: 3, column: 10, check: 'gspot.marketing', message: "Marketing word 'robust'." },
            {
                file: 'stdin.rb',
                line: 2,
                column: 5,
                check: 'Google.We',
                message: 'Try not to use first-person plural.',
            },
        ]);
    });

    test('native paths and filenames with control characters retain their complete locations', () => {
        const path = join('docs', 'café:part\nname.md');
        expect(
            parseAlerts(
                JSON.stringify({
                    [path]: [{ Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: 'Marketing word.' }],
                }) + '\r\n',
            ),
        ).toStrictEqual([
            {
                file: 'docs/café:part\nname.md',
                line: 3,
                column: 10,
                check: 'gspot.marketing',
                message: 'Marketing word.',
            },
        ]);
    });

    test.each(['diagnostic text', '{"file.md":[{}]}'])('malformed output %s cannot become a clean result', (output) => {
        expect(() => parseAlerts(output)).toThrow(output.startsWith('{') ? 'Line' : 'JSON Parse error');
    });
    test('an empty native report has no alerts', () => {
        expect(parseAlerts('{}')).toStrictEqual([]);
    });
});
