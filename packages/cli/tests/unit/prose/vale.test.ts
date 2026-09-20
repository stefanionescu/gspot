import { join } from 'node:path';
import { parseAlerts } from '#cli/prose/vale.ts';
import { describe, expect, test } from 'bun:test';
import { vocabularyText } from '#cli/prose/vocabulary.ts';

describe('vale output', () => {
    test('line output parses into alerts', () => {
        const alerts = parseAlerts(
            "docs/a.md:3:10:gspot.marketing:Marketing word 'robust'.\nstdin.rb:2:5:Google.We:Try not to use first-person plural.\n\n",
        );
        expect(alerts).toEqual([
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

    test('native paths and CRLF output retain the location without carriage returns', () => {
        const path = join('docs', 'café.md');
        expect(parseAlerts(`${path}:3:10:gspot.marketing:Marketing word.\r\n`)).toEqual([
            { file: 'docs/café.md', line: 3, column: 10, check: 'gspot.marketing', message: 'Marketing word.' },
        ]);
    });

    test('a vocabulary file is one word per line', () => {
        expect(vocabularyText(['a', 'b'])).toBe('a\nb\n');
        expect(vocabularyText([])).toBe('');
    });
});
