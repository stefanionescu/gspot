import { test, expect } from 'bun:test';
import { commentText, parseComments } from '#cli/parsers/source/public.ts';
import { COMMENT_BOUNDARIES } from '#tests/config/cli/parsers/comments.ts';

// The lines of the comments in a source that open with the marker; a marker inside a string or a block value is no comment.
async function markedLines(path: string, source: string): Promise<number[]> {
    const comments = await parseComments(path, source);
    return comments
        .filter((comment) => /^(?:\/\/|#|--|<!--) ?marker:/u.test(commentText(comment.text)))
        .map((comment) => comment.line);
}

test('a shell comment after a quoted apostrophe stays a comment while quoted marker text stays literal', async () => {
    const source =
        'echo "Sid\'s value" # marker: Required external interface.\necho "# marker: Literal fixture text."\n';
    expect(await markedLines('source.sh', source)).toStrictEqual([1]);
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value hides the comment text after it', async (opener) => {
    const source = [
        '-- marker: Required interface.',
        `SELECT ${opener}`,
        '-- marker: Literal fixture text.',
        ':value;',
    ];
    expect(await markedLines('source.sql', source.join('\n'))).toStrictEqual([1]);
});

test.each(COMMENT_BOUNDARIES)('%s preserves the comment boundary', async (_label, path, source, line) => {
    expect(await markedLines(path, source)).toStrictEqual([line]);
});
