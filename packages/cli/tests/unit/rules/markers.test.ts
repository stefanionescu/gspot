import { describe, expect, test } from 'bun:test';

import {
    countMarkers,
    markedLines,
    markerFindings,
    parseMarker,
    statementsOf,
    withoutMarker,
} from '#cli/rules/markers.ts';

const FILE = [
    '---',
    'layer: code',
    '---',
    '',
    '# Title',
    '',
    'Explanatory prose that opens with no imperative.',
    '',
    'Do not use `enum`. `enforced-by: typescript/eslint no-restricted-syntax`',
    '',
    '- Prefer duplication over the wrong abstraction. `unenforced`',
    '- A wrapped item',
    '  continues here. `enforced-by: naming/identifiers`',
    '- Introduces a list:',
    '    - Nested item without a marker',
    '',
    '```ts',
    '- not a statement',
    '```',
    '',
    '| a | b |',
    '',
    'Bad:',
    '',
    'Keep it short.',
];

describe('markers', () => {
    test('parse both marker forms and strip them', () => {
        expect(parseMarker('x `enforced-by: bash/shellcheck SC2086`')).toEqual({
            kind: 'enforced',
            check: 'bash/shellcheck',
        });
        expect(parseMarker('x `unenforced`')).toEqual({ kind: 'unenforced' });
        expect(parseMarker('x')).toBeUndefined();
        expect(withoutMarker('x `unenforced`')).toBe('x');
    });

    test('statements are list items and imperative paragraphs, not introducers, tables, fences or labels', () => {
        const statements = statementsOf(FILE);
        expect(statements.map((statement) => statement.text)).toEqual([
            'Do not use `enum`.',
            'Prefer duplication over the wrong abstraction.',
            'A wrapped item continues here.',
            'Nested item without a marker',
            'Keep it short.',
        ]);
        expect(statements[2]?.end).toBe(12);
        expect(countMarkers(statements)).toEqual({ statements: 5, unenforced: 3 });
    });

    test('findings name unmarked statements and unknown ids', () => {
        const findings = markerFindings('a.md', statementsOf(FILE), new Set(['typescript/eslint']));
        expect(findings.map((finding) => `${String(finding.line)} ${finding.message}`)).toEqual([
            "12 unknown check id 'naming/identifiers'",
            '15 statement without a marker',
            '25 statement without a marker',
        ]);
    });

    test('markedLines writes a marker on every statement and clears introducers', () => {
        const marked = markedLines(
            ['- Introduces: `unenforced`', '- Use it. `unenforced`', '', 'Keep going.'],
            (text) => (text.startsWith('Use') ? 'bash/shellcheck' : undefined),
        );
        expect(marked).toEqual([
            '- Introduces:',
            '- Use it. `enforced-by: bash/shellcheck`',
            '',
            'Keep going. `unenforced`',
        ]);
    });
});
