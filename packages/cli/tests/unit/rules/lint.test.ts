import { describe, expect, test } from 'bun:test';
import { isRulePath, lintRules } from '#cli/rules/lint.ts';

const OPTIONS = { checkIds: new Set(['naming/identifiers']), presetIds: new Set(['naming', 'rules']) };

function file(path: string, body: string): { path: string; text: string } {
    return { path, text: `---\nlayer: code\npreset: naming\ntitle: T\n---\n\n# T\n\n${body}` };
}

describe('corpus lint', () => {
    test('knows which paths are corpus files', () => {
        expect(isRulePath('general/code/NAMING.md')).toBe(true);
        expect(isRulePath('templates/docs/X.md')).toBe(true);
        expect(isRulePath('check-ids.txt')).toBe(false);
    });

    test('a clean file has no findings and its markers are counted', () => {
        const report = lintRules(
            [
                file(
                    'general/code/A.md',
                    '- Name things well. `enforced-by: naming/identifiers`\n- Or not. `unenforced`\n',
                ),
            ],
            OPTIONS,
        );
        expect(report.findings).toEqual([]);
        expect(report.counts).toEqual({ statements: 2, unenforced: 1 });
        expect(report.isValeRun).toBe(false);
    });

    test('fences, links, em dashes, boundary words and corruption are reported', () => {
        const body = [
            '```',
            'x',
            '```',
            '',
            'See [it](../general/code/B.md). `unenforced`',
            '',
            'Use yap here — now. `unenforced`',
            '',
            '- item keys `unenforced`',
            '',
            '```ts',
            'open',
        ].join('\n');
        const report = lintRules([file('general/code/A.md', body)], OPTIONS);
        const messages = report.findings.map((finding) => finding.message);
        expect(messages).toContain('fenced block without a language tag');
        expect(messages).toContain('link to another rule file');
        expect(messages).toContain('em dash');
        expect(messages.some((text) => text.startsWith('layer boundary'))).toBe(true);
        expect(messages.some((text) => text.startsWith('corruption residue'))).toBe(true);
        expect(messages).toContain('unclosed fenced block');
    });
});
