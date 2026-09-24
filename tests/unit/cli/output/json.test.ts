import { parseJson } from '#cli/output/json.ts';
import { describe, expect, test } from 'bun:test';

describe('parseJson', () => {
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

    test.each(['', 'fatal error', '{ broken', '{}', '{"items":null}'])('invalid report %s is rejected', (stdout) => {
        expect(() => parseJson('x/y', { format: 'json', items: 'items' }, stdout, 'help')).toThrow();
    });

    test('valid empty reports remain clean and missing nested lists are rejected', () => {
        expect(parseJson('x/y', { format: 'json' }, '[]', 'help')).toStrictEqual([]);
        expect(() => parseJson('x/y', { format: 'json' }, '[null]', 'help')).toThrow();
        expect(() => parseJson('x/y', { format: 'json', fields: { message: 'message' } }, '[{}]', 'help')).toThrow();
        expect(() => parseJson('x/y', { format: 'json', children: 'messages' }, '[{}]', 'help')).toThrow();
    });
});
