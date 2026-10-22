import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const reads = createReadCache(process.cwd());
    const source = 'const counter: number = 1;';
    const resources = new DisposableStack();
    const copies: Awaited<ReturnType<typeof parseSource>>[] = [];
    try {
        const typescript = await parseSource('typescript', source, { reads, resources });
        copies.push(typescript);
        const javascript = await parseSource('javascript', source, { reads, resources });
        copies.push(javascript);
        const repeated = await parseSource('typescript', source, { reads, resources });
        copies.push(repeated);
        expect(typescript.rootNode.hasError).toBe(false);
        expect(javascript.rootNode.hasError).toBe(true);
        expect(repeated.rootNode.text).toBe(source);
        resources.dispose();
        expect(typescript.rootNode.text).toBe(source);
        using nextResources = new DisposableStack();
        const afterCleanup = await parseSource('typescript', source, { reads, resources: nextResources });
        copies.push(afterCleanup);
        expect(afterCleanup.rootNode.hasError).toBe(false);
        expect(afterCleanup.rootNode.text).toBe(source);
    } finally {
        resources.dispose();
        for (const tree of copies) tree.delete();
    }
});
