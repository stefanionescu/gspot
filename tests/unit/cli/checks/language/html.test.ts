// The script analysis of the HTML kit on markup text: executable URLs are reported, inert markup is not.
import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { scriptProblems } from '#cli/checks/language/html.ts';

async function problems(markup: string): Promise<{ rule: string; column: number }[]> {
    const tree = await parseSource('html', markup);
    if (tree === null) throw new Error('The HTML parser returned no tree.');
    try {
        return scriptProblems(tree.rootNode).map(({ rule, node }) => ({ rule, column: node.startPosition.column + 1 }));
    } finally {
        tree.delete();
    }
}

test.each([
    ['<a href="javascript:alert(1)">Link</a>', 4],
    ['<a href="jav&#x61;script&colon;alert(1)">Link</a>', 4],
    ['<a href="java&#9;script:alert(1)">Link</a>', 4],
    ['<a href=" VbScRiPt:msgbox(1)">Link</a>', 4],
    ['<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', 4],
    ['<iframe src="data:text/html,example"></iframe>', 9],
    ['<object data="data:image/svg+xml,example"></object>', 9],
    ['<script src="data:text/javascript,alert(1)"></script>', 9],
])('the script analysis reports the executable URL in %s', async (markup, column) => {
    expect(await problems(markup)).toStrictEqual([{ rule: 'script-link', column }]);
});

test.each([
    '<a href="/page">Link</a><script src="/app.js"></script>',
    '<a href="/page" title="javascript: is a scheme">Link</a>',
    '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">',
    '<img src="data:image/svg+xml,example" alt="Image">',
    '<a href="data:text/plain,example" download>Download</a>',
    '<script type="application/ld+json">{"name":"example"}</script>',
])('the script analysis accepts the inert markup %s', async (markup) => {
    expect(await problems(markup)).toStrictEqual([]);
});
