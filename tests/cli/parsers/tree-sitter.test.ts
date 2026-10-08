import { join } from 'node:path';
import { testdir } from 'testdirs';
import { Tree } from 'web-tree-sitter';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { rejection } from '#tests/harness/expectations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { readPython, disposePython } from '#cli/parsers/python.ts';
import { readSwift, disposeSwift } from '#cli/parsers/swift/source.ts';
import { TYPED_DECLARATION } from '#tests/config/cli/parsers/tree-sitter.ts';
import { parserFor, parseSource, visitParsed } from '#cli/parsers/tree-sitter.ts';

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

test('a rejected observation read is evicted and partial trees are released before a retry', async () => {
    await using sandbox = await testdir({ 'first.py': 'def first():\n    return 1\n' });
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    using resources = new DisposableStack();
    const input = {
        root: sandbox.path,
        reads,
        resources,
        files: [
            { path: 'first.py', kind: 'source' },
            { path: 'second.py', kind: 'source' },
        ],
    };
    using parser = spyOn(await parserFor('python'), 'parse');
    using deletion = spyOn(Tree.prototype, 'delete');
    const failed = await rejection(visitParsed(input, readPython, disposePython));
    expect(failed).toContain('second.py');
    expect(deletion).toHaveBeenCalledTimes(1);
    await writeFile(join(sandbox.path, 'second.py'), 'def second():\n    return 2\n');
    using recovered = await visitParsed(input, readPython, disposePython);
    expect(recovered.value.functions.map(({ name }) => name)).toStrictEqual(['first', 'second']);
    expect(recovered.value.modules[0]!.tree.rootNode.text).toBe('def first():\n    return 1\n');
    expect(parser).toHaveBeenCalledTimes(2);
    using repeated = await visitParsed(input, readPython, disposePython);
    expect(repeated.value).toBe(recovered.value);
    resources.dispose();
    expect(deletion).toHaveBeenCalledTimes(5);
});

test('observation caches separate readers and retain selected path order', async () => {
    await using sandbox = await testdir({ 'first.py': 'first = 1\n', 'second.py': 'second = 2\n' });
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    using resources = new DisposableStack();
    const input = {
        root: sandbox.path,
        reads,
        resources,
        files: [
            { path: 'first.py', kind: 'source' },
            { path: 'second.py', kind: 'source' },
        ],
    };
    const held = await Promise.all([
        visitParsed(input, readPython, disposePython),
        visitParsed(input, readPython, disposePython),
    ]);
    using python = held[0];
    using concurrent = held[1];
    expect(concurrent.value).toBe(python.value);
    using swift = await visitParsed(input, readSwift, disposeSwift);
    expect(swift.value.sources).toStrictEqual([]);
    using reversed = await visitParsed({ ...input, files: input.files.toReversed() }, readPython, disposePython);
    expect(reversed.value).not.toBe(python.value);
    expect(python.value.modules.map(({ path }) => path)).toStrictEqual(['first.py', 'second.py']);
    expect(reversed.value.modules.map(({ path }) => path)).toStrictEqual(['second.py', 'first.py']);
});
