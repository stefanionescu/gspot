import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { TYPED_DECLARATION } from '#tests/config/typescript.ts';
import { readPython, disposePython } from '#cli/parsers/python.ts';
import { visitParsed, createReadCache } from '#cli/system/files/cache.ts';

test('parses are cached per run and copied trees outlive the cache', async () => {
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
        expect(repeated).not.toBe(typescript);
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

test('a second visit with the same files returns the same value, in the same path order', async () => {
    await using sandbox = await testdir({ 'first.py': 'first = 1\n', 'second.py': 'second = 2\n' });
    const reads = createReadCache(sandbox.path);
    using resources = new DisposableStack();
    const input = {
        root: reads.root,
        reads,
        resources,
        files: [
            { path: 'first.py', kind: 'source' },
            { path: 'second.py', kind: 'source' },
        ],
    };
    const held = await Promise.all([
        visitParsed(input, readPython, disposePython, resources),
        visitParsed(input, readPython, disposePython, resources),
    ]);
    const python = held[0];
    const concurrent = held[1];
    expect(concurrent).toBe(python);
    const reversed = await visitParsed(
        { ...input, files: input.files.toReversed() },
        readPython,
        disposePython,
        resources,
    );
    expect(reversed).not.toBe(python);
    expect(python.modules.map(({ path }) => path)).toStrictEqual(['first.py', 'second.py']);
    expect(reversed.modules.map(({ path }) => path)).toStrictEqual(['second.py', 'first.py']);
});
