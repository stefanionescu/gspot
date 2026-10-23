import { test, expect } from 'bun:test';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/config/parsers/managed-blocks.ts';
import { replaceBlock, findBlockBody, findBlockSpan } from '#cli/parsers/managed-blocks.ts';

test('a managed block is appended and replaced without changing your own text', () => {
    const first = replaceBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md', style: 'markdown' });
    expect(findBlockBody(first, { path: 'AGENTS.md', style: 'markdown' })).toBe('block one');
    const second = replaceBlock(first, 'block two', { path: 'AGENTS.md', style: 'markdown' });
    expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
    expect(findBlockBody(second, { path: 'AGENTS.md', style: 'markdown' })).toBe('block two');
    expect(second).toStartWith('# Mine\n\ntext\n\n');
    expect(replaceBlock(second, 'block two', { path: 'AGENTS.md', style: 'markdown' })).toBe(second);
});
test.each([...MALFORMED_BLOCKS])('every block operation refuses malformed markers in $path: $source', (context) => {
    const { source, path } = context;
    const message = `${path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`;
    expect(() => findBlockSpan(source, context)).toThrow(message);
    expect(() => findBlockBody(source, context)).toThrow(message);
    expect(() => replaceBlock(source, 'replacement', context)).toThrow(message);
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
    expect(findBlockBody('authored text', context)).toBeUndefined();
    const { newline } = context;
    const source = `before${newline}${context.start}${newline}  instructions  ${newline}${context.end}${newline}after`;
    expect(findBlockBody(source, context)).toBe('instructions');
    const replaced = replaceBlock(source, 'replacement', context);
    expect(replaced).toStartWith(`before${newline}`);
    expect(replaced).toEndWith('after');
    expect(findBlockBody(replaced, context)).toBe('replacement');
});
