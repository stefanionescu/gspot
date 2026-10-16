import { test, expect } from 'bun:test';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import { MARKER_COMMENT, COMMENT_BOUNDARIES } from '#tests/config/comments.ts';

// Find comments that start with the marker. Skip markers inside strings and block values.
async function markedLines(path: string, source: string): Promise<number[]> {
    const comments = await parseComments(path, source);
    return comments
        .filter((comment) => MARKER_COMMENT.test(stripCommentEnd(comment.text)))
        .map((comment) => comment.line);
}

test('a Bash comment after a quoted apostrophe is a comment, and quoted marker text is not', async () => {
    const source =
        'echo "Sid\'s value" # marker: Required external interface.\necho "# marker: Literal sample text."\n';
    expect(await markedLines('source.sh', source)).toStrictEqual([1]);
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value hides the comment text after it', async (opener) => {
    const source = ['-- marker: Required interface.', `SELECT ${opener}`, '-- marker: Literal sample text.', ':value;'];
    expect(await markedLines('source.sql', source.join('\n'))).toStrictEqual([1]);
});

test.each(COMMENT_BOUNDARIES)('%s keeps the comment boundary', async (_label, path, source, line) => {
    expect(await markedLines(path, source)).toStrictEqual([line]);
});
