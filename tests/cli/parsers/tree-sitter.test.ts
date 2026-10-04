import { test, spyOn, expect } from 'bun:test';
import { rejection } from '#tests/harness/expectations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { parseSqlFile } from '#cli/parsers/sql/statements.ts';
import { parserFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { SQL_DECLARATION, TYPED_DECLARATION } from '#tests/config/cli/parsers/tree-sitter.ts';

test('run-owned parses separate grammars and copied trees survive cache cleanup', async () => {
    const reads: ReadCache = { root: '/repository', sources: new Map(), memo: new Map() };
    const resources = new DisposableStack();
    const copies: Awaited<ReturnType<typeof parseSource>>[] = [];
    try {
        const typescript = await parseSource('typescript', TYPED_DECLARATION, { reads, resources });
        copies.push(typescript);
        const javascript = await parseSource('javascript', TYPED_DECLARATION, { reads, resources });
        copies.push(javascript);
        const repeated = await parseSource('typescript', TYPED_DECLARATION, { reads, resources });
        copies.push(repeated);
        expect(typescript.rootNode.hasError).toBe(false);
        expect(javascript.rootNode.hasError).toBe(true);
        expect(repeated).not.toBe(typescript);
        expect(repeated.rootNode.text).toBe(TYPED_DECLARATION);
        const sql = await parseSqlFile(SQL_DECLARATION, reads);
        expect(sql.error).toBeUndefined();
        expect(sql.statements).toHaveLength(1);
        resources.dispose();
        expect(typescript.rootNode.text).toBe(TYPED_DECLARATION);
        using nextResources = new DisposableStack();
        const afterCleanup = await parseSource('typescript', TYPED_DECLARATION, { reads, resources: nextResources });
        copies.push(afterCleanup);
        expect(afterCleanup.rootNode.hasError).toBe(false);
        expect(afterCleanup.rootNode.text).toBe(TYPED_DECLARATION);
    } finally {
        resources.dispose();
        for (const tree of copies) tree.delete();
    }
});

test('a native parser that returns no tree is refused before a reader receives it', async () => {
    using _parse = spyOn(await parserFor('python'), 'parse').mockReturnValue(null);
    expect(await rejection(parseSource('python', 'value = 1\n'))).toBe('The python parser returned no tree.');
});
