import { test, expect } from 'bun:test';
import { parseJsonFindings } from '#cli/parsers/output/json.ts';
import { parseOutput, outputSchema } from '#cli/parsers/output/formats.ts';

test('a flat JSON list maps its fields to a finding', () => {
    const stdout = JSON.stringify([{ path: 'nginx.conf', line: 9, plugin: 'ssrf', summary: 'Possible SSRF.' }]);
    const output = {
        format: 'json' as const,
        file_type: 'path' as const,
        fields: { file: 'path', line: 'line', rule: 'plugin', message: 'summary' },
    };
    expect(
        parseJsonFindings({
            check: 'nginx/gixy',
            output: outputSchema.parse(output),
            stdout: stdout,
            text: stdout,
            help: 'help',
            root: process.cwd(),
            cwd: process.cwd(),
        }),
    ).toStrictEqual([
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
        file_type: 'path' as const,
        items: 'files',
        children: 'violations',
        fields: { file: 'filepath', line: 'start_line_no', rule: 'code', message: 'description' },
    };
    const [finding] = parseJsonFindings({
        check: 'sql/sqlfluff',
        output: outputSchema.parse(output),
        stdout: stdout,
        text: stdout,
        help: 'help',
        root: process.cwd(),
        cwd: process.cwd(),
    });
    expect([finding?.file, finding?.line, finding?.rule]).toStrictEqual(['a.sql', 3, 'LT01']);
});

test.each([
    ['absent', {}, false],
    ['object', { fix: { range: [0, 1], text: '' } }, true],
    ['null', { fix: null }, true],
    ['false', { fix: false }, true],
] as const)(
    'a JSON finding is fixable only when the check has a fix command: %s fix field',
    (name, extra, expected) => {
        const output = {
            format: 'json' as const,
            file_type: 'path' as const,
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
    },
);

test('a tool that counts lines from zero names its line base', () => {
    const stdout = JSON.stringify([{ file: 'a.sql', line: 0, column: 18, rule_name: 'r', message: 'm' }]);
    const output = {
        format: 'json' as const,
        file_type: 'path' as const,
        line_base: 0 as const,
        fields: { file: 'file', line: 'line', column: 'column', rule: 'rule_name', message: 'message' },
    };
    const [finding] = parseJsonFindings({
        check: 'postgres/squawk',
        output: outputSchema.parse(output),
        stdout: stdout,
        text: stdout,
        help: 'help',
        root: process.cwd(),
        cwd: process.cwd(),
    });
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
        file_type: 'path' as const,
        items: 'results',
        children: 'packages.vulnerabilities',
        fields: { file: 'source.path', rule: 'id', message: 'package.name package.version summary' },
    };
    const [finding] = parseJsonFindings({
        check: 'dependencies/osv',
        output: outputSchema.parse(output),
        stdout: stdout,
        text: stdout,
        help: 'help',
        root: process.cwd(),
        cwd: process.cwd(),
    });
    expect([finding?.file, finding?.rule, finding?.message]).toStrictEqual([
        'bun.lock',
        'GHSA-1',
        'qs 6.15.3 Denial of service.',
    ]);
});

test.each(['', '{ broken', '{"items":null}'])('an invalid JSON report is refused: %s', (stdout) => {
    expect(() =>
        parseJsonFindings({
            check: 'x/y',
            output: outputSchema.parse({ format: 'json', items: 'items' }),
            stdout: stdout,
            text: stdout,
            help: 'help',
            root: process.cwd(),
            cwd: process.cwd(),
        }),
    ).toThrow('JSON returned invalid structured findings.');
});

test('an empty report has no findings, and missing nested lists are refused', () => {
    expect(
        parseJsonFindings({
            check: 'x/y',
            output: outputSchema.parse({ format: 'json' }),
            stdout: '[]',
            text: '[]',
            help: 'help',
            root: process.cwd(),
            cwd: process.cwd(),
        }),
    ).toStrictEqual([]);
    for (const output of [
        { format: 'json' as const },
        { format: 'json' as const, file_type: 'path' as const, fields: { message: 'message' } },
        { format: 'json' as const, file_type: 'path' as const, children: 'messages' },
    ])
        expect(() =>
            parseJsonFindings({
                check: 'x/y',
                output: outputSchema.parse(output),
                stdout: output.fields === undefined && output.children === undefined ? '[null]' : '[{}]',
                text: output.fields === undefined && output.children === undefined ? '[null]' : '[{}]',
                help: 'help',
                root: process.cwd(),
                cwd: process.cwd(),
            }),
        ).toThrow('JSON returned invalid structured findings.');
});
