import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/grammars.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { TYPED_DECLARATION } from '#tests/data/checks/typescript/projects.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const reads = createReadCache(process.cwd());
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
        expect(repeated.rootNode.text).toBe(TYPED_DECLARATION);
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
