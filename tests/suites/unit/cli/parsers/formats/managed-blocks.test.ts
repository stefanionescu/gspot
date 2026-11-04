import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { BLOCK_FORMATS, MALFORMED_BLOCKS } from '#tests/config/parsers/formats.ts';
import { replaceBlock, findBlockBody, findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';

test('a managed block is appended and replaced without changing your own text', () => {
    const first = replaceBlock('# Mine\n\ntext\n', 'block one', { path: 'AGENTS.md' });
    expect(findBlockBody(first, { path: 'AGENTS.md' })).toBe('block one');
    const second = replaceBlock(first, 'block two', { path: 'AGENTS.md' });
    expect(second.match(/gspot managed >>>/g)).toHaveLength(1);
    expect(findBlockBody(second, { path: 'AGENTS.md' })).toBe('block two');
    expect(second).toStartWith('# Mine\n\ntext\n\n');
    expect(replaceBlock(second, 'block two', { path: 'AGENTS.md' })).toBe(second);
});
test.each([...MALFORMED_BLOCKS])('every block operation refuses malformed markers in $path: $source', (context) => {
    const { source, path } = context;
    const refusal = matchFields<GspotError>({
        name: 'GspotError',
        code: 'filesystem',
        message: expect.stringContaining(path) as string,
    });
    expect(() => findBlockSpan(source, context)).toThrow(refusal);
    expect(() => findBlockBody(source, context)).toThrow(refusal);
    expect(() => replaceBlock(source, 'replacement', context)).toThrow(refusal);
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
