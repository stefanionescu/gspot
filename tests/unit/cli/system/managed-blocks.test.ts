import { test, expect } from 'bun:test';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/config/system.ts';
import { readBlock, replaceBlock, findBlockSpan } from '#cli/system/managed-blocks.ts';

test('a managed block is appended and replaced without changing your own text', () => {
    const first = replaceBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md', style: 'markdown' });
    expect(first).toContain('# Mine');
    expect(readBlock(first, { path: 'AGENTS.md', style: 'markdown' })).toBe('block one');
    const second = replaceBlock(first, 'block two', { path: 'AGENTS.md', style: 'markdown' });
    expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
    expect(readBlock(second, { path: 'AGENTS.md', style: 'markdown' })).toBe('block two');
    expect(second.startsWith('# Mine\n\ntext\n\n')).toBe(true);
    expect(replaceBlock(second, 'block two', { path: 'AGENTS.md', style: 'markdown' })).toBe(second);
});

test.each([...MALFORMED_BLOCKS])('every block operation refuses malformed markers in $path: $source', (context) => {
    const { source, path } = context;
    const diagnostic = `${path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`;
    expect(() => findBlockSpan(source, context)).toThrow(diagnostic);
    expect(() => readBlock(source, context)).toThrow(diagnostic);
    expect(() => replaceBlock(source, 'replacement', context)).toThrow(diagnostic);
});

test.each(
    BLOCK_FORMATS.flatMap((context) =>
        (
            [
                ['\n', 'LF'],
                ['\r\n', 'CRLF'],
            ] as const
        ).map(([newline, name]) => ({ ...context, newline, name })),
    ),
)('block readers keep your own text with $name line endings in $path', (context) => {
    expect(findBlockSpan('authored text', context)).toBeUndefined();
    expect(readBlock('authored text', context)).toBeUndefined();
    const { newline } = context;
    const source = `before${newline}${context.start}${newline}  instructions  ${newline}${context.end}${newline}after`;
    expect(readBlock(source, context)).toBe('instructions');
    const replaced = replaceBlock(source, 'replacement', context);
    expect(replaced.startsWith(`before${newline}`)).toBe(true);
    expect(replaced.endsWith('after')).toBe(true);
    expect(readBlock(replaced, context)).toBe('replacement');
});
