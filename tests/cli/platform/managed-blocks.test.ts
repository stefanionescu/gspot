import { test, expect, describe } from 'bun:test';
import { blockSpan, applyBlock, currentBlock } from '#cli/platform/managed-blocks.ts';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/config/cli/platform/managed-blocks.ts';

describe('managed blocks', () => {
    test('are appended and replaced without changing authored text', () => {
        const first = applyBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md', style: 'markdown' });
        expect(first).toContain('# Mine');
        expect(currentBlock(first, { path: 'AGENTS.md', style: 'markdown' })).toBe('block one');
        const second = applyBlock(first, 'block two', { path: 'AGENTS.md', style: 'markdown' });
        expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
        expect(currentBlock(second, { path: 'AGENTS.md', style: 'markdown' })).toBe('block two');
        expect(second.startsWith('# Mine\n\ntext\n\n')).toBe(true);
        expect(applyBlock(second, 'block two', { path: 'AGENTS.md', style: 'markdown' })).toBe(second);
    });
});

test.each(MALFORMED_BLOCKS)('all block operations reject malformed markers in $path: $source', (context) => {
    const { source, path } = context;
    const diagnostic = `${path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`;
    expect(() => blockSpan(source, context)).toThrow(diagnostic);
    expect(() => currentBlock(source, context)).toThrow(diagnostic);
    expect(() => applyBlock(source, 'replacement', context)).toThrow(diagnostic);
});

test.each([...BLOCK_FORMATS])(
    'block readers preserve authored text and accept LF and CRLF markers in $path',
    (context) => {
        expect(blockSpan('authored text', context)).toBeUndefined();
        expect(currentBlock('authored text', context)).toBeUndefined();
        for (const newline of ['\n', '\r\n']) {
            const source = `before${newline}${context.start}${newline}  instructions  ${newline}${context.end}${newline}after`;
            expect(currentBlock(source, context)).toBe('instructions');
            const replaced = applyBlock(source, 'replacement', context);
            expect(replaced.startsWith(`before${newline}`)).toBe(true);
            expect(replaced.endsWith('after')).toBe(true);
            expect(currentBlock(replaced, context)).toBe('replacement');
        }
    },
);
