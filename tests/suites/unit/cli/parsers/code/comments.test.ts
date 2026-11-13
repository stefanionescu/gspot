import { expect, test } from 'bun:test';

import { parseComments, stripCommentEnd } from '#cli/parsers/code/comments.ts';
import { COMMENT_BOUNDARIES, COMPONENT_SCRIPT_COMMENTS } from '#tests/config/parsers/comments.ts';

async function listMarkedLines(path: string, source: string, tags: readonly string[]): Promise<number[]> {
    const comments = await parseComments(path, source, tags);
    return comments
        .filter((comment) => /^(?:\/\/|#|--|<!--) ?marker:/u.test(stripCommentEnd(comment.text)))
        .map((comment) => comment.line);
}

test.each(COMMENT_BOUNDARIES.map(([label, path, source, line, tags]) => ({ label, path, source, line, tags })))(
    '$label: only the comment after the string counts as a comment',
    async ({ path, source, line, tags }) => {
        expect(await listMarkedLines(path, source, tags)).toStrictEqual([line]);
    },
);

test.each([...COMPONENT_SCRIPT_COMMENTS])(
    'component comments keep script and markup positions in $path',
    async ({ path, source, lines }) => {
        expect(await listMarkedLines(path, source, [])).toStrictEqual([...lines]);
    },
);

test('MDX recognizes expression and HTML comments without reading comments from exported strings or code', async () => {
    const comments = await parseComments(
        'page.mdx',
        'export const value = "{/* hidden */}";\n\n{/* visible */}\n```mdx\n{/* fenced */}\n<!-- fenced -->\n```\n`{/* inline */}`\n\n<!-- vale off -->\n',
        [],
    );
    expect(comments.map(({ line, text }) => ({ line, text }))).toStrictEqual([
        { line: 3, text: '/* visible */' },
        { line: 10, text: '<!-- vale off -->' },
    ]);
});
