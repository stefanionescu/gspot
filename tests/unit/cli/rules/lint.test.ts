import { describe, expect, test } from 'bun:test';
import { isRulePath, lintRules } from '#cli/agents/lint.ts';

function file(path: string, body: string): { path: string; text: string } {
    return { path, text: `---\nlayer: code\nconfiguration: naming\ntitle: T\n---\n\n# T\n\n${body}` };
}

describe('rule lint', () => {
    test('knows which paths are rule files', () => {
        expect(isRulePath('general/code/NAMING.md')).toBe(true);
        expect(isRulePath('templates/docs/X.md')).toBe(true);
        expect(isRulePath('check-ids.txt')).toBe(false);
    });

    test('a clean file has no findings', () => {
        const report = lintRules([file('general/code/A.md', '- Name things well.\n- Or not.\n')]);
        expect(report.findings).toStrictEqual([]);
    });

    test('fences, links, em dashes, boundary words and corruption are reported', () => {
        const body = [
            '```',
            'x',
            '```',
            '',
            'See [it](../general/code/B.md).',
            '',
            'Use yap here — now.',
            '',
            '- item keys',
            '',
            '```ts',
            'open',
        ].join('\n');
        const report = lintRules([file('general/code/A.md', body)]);
        const messages = report.findings.map((finding) => finding.message);
        expect(messages).toContain('fenced block without a language tag');
        expect(messages).toContain('link to another rule file');
        expect(messages).toContain('em dash');
        expect(messages.some((text) => text.startsWith('layer boundary'))).toBe(true);
        expect(messages.some((text) => text.startsWith('corruption residue'))).toBe(true);
        expect(messages).toContain('unclosed fenced block');
    });
});
