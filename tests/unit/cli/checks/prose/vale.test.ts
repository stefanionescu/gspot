import { parseAlerts } from '#cli/checks/prose/vale.ts';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

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

    test.each([
        '',
        'diagnostic text',
        '[]',
        '{"file.md":null}',
        '{"file.md":[{}]}',
        '{"file.md":[{"Line":0,"Span":[1,2],"Check":"Rule","Message":"Finding"}]}',
    ])('malformed output %s cannot become a clean result', (output) => {
        expect(() => parseAlerts(output)).toThrow();
        expect(parseAlerts('{}')).toStrictEqual([]);
    });
});
