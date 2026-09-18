import { describe, expect, test } from 'bun:test';
import { parseJson } from '#cli/run/json-output.ts';

describe('parseJson', () => {
    test('a flat list maps its fields to a finding', () => {
        const stdout = JSON.stringify([{ path: 'nginx.conf', line: 9, plugin: 'ssrf', summary: 'Possible SSRF.' }]);
        const output = {
            format: 'json' as const,
            fields: { file: 'path', line: 'line', rule: 'plugin', message: 'summary' },
        };
        expect(parseJson('nginx/gixy', output, stdout, 'help')).toEqual([
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
        expect([finding?.file, finding?.line, finding?.rule]).toEqual(['a.sql', 3, 'LT01']);
    });

    test('text that is not JSON becomes one finding that shows it', () => {
        const findings = parseJson('x/y', { format: 'json' }, '{ broken', 'help');
        expect(findings[0]?.message).toBe('{ broken');
    });
});
