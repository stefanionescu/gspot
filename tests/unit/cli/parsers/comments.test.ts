import { test, expect } from 'bun:test';
import { parseComments, stripCommentEnd } from '#cli/parsers/comments.ts';
import { MARKER_COMMENT, COMMENT_BOUNDARIES } from '#tests/data/parsers/comments.ts';
import { QUOTED_ESLINT_COMMENTS } from '#tests/data/checks/gspot/suppressions/syntax.ts';

// Find comments that start with the marker. Skip markers inside strings and block values.
async function listMarkedLines(path: string, source: string, tags: readonly string[]): Promise<number[]> {
    const comments = await parseComments(path, source, tags);
    return comments
        .filter((comment) => MARKER_COMMENT.test(stripCommentEnd(comment.text)))
        .map((comment) => comment.line);
}

test('a Bash comment after a quoted apostrophe is a comment, and quoted marker text is not', async () => {
    const source =
        'echo "Sid\'s value" # marker: Required external interface.\necho "# marker: Literal sample text."\n';
    expect(await listMarkedLines('source.sh', source, [])).toStrictEqual([1]);
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value hides the comment text after it', async (opener) => {
    const source = ['-- marker: Required interface.', `SELECT ${opener}`, '-- marker: Literal sample text.', ':value;'];
    expect(await listMarkedLines('source.sql', source.join('\n'), [])).toStrictEqual([1]);
});

test.each(COMMENT_BOUNDARIES)(
    '%s: only the comment after the string counts as a comment',
    async (_label, path, source, line, tags) => {
        expect(await listMarkedLines(path, source, tags)).toStrictEqual([line]);
    },
);

test.each(['source.js', 'source.ts'])(
    'comment markers inside strings and templates in %s are not comments',
    async (path) => {
        expect(await listMarkedLines(path, QUOTED_ESLINT_COMMENTS, [])).toStrictEqual([12]);
    },
);
