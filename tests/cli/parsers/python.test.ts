import { testdir } from 'testdirs';
import { Tree } from 'web-tree-sitter';
import { test, spyOn, expect } from 'bun:test';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { readPython, disposePython } from '#cli/parsers/python.ts';
import { PYTHON_SOURCES } from '#tests/config/cli/parsers/python.ts';

test('Python observations reuse selected paths while isolating scopes and resource owners', async () => {
    await using sandbox = await testdir(PYTHON_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    using resources = new DisposableStack();
    const input = { root: sandbox.path, reads, resources, files: [{ path: 'api/order.py', kind: 'source' }] };
    using first = await visitParsed(input, readPython, disposePython);
    using deletion = spyOn(first.value.modules[0]!.tree, 'delete');
    expect(first.value.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
        { path: 'api/order.py', name: 'total' },
        { path: 'api/order.py', name: 'lambda' },
    ]);
    const selectedFiles = input.files.map((file) => ({ ...file, prefix: Buffer.from('changed metadata') }));
    using repeated = await visitParsed(
        {
            ...input,
            files: selectedFiles,
        },
        readPython,
        disposePython,
    );
    expect(repeated.value).toBe(first.value);
    expect(repeated.value.modules[0]!.tree.rootNode.text).toBe(PYTHON_SOURCES['api/order.py']);
    using scoped = await visitParsed(
        { ...input, files: [{ path: 'worker/order.py', kind: 'source' }] },
        readPython,
        disposePython,
    );
    expect(scoped.value).not.toBe(first.value);
    expect(scoped.value.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
        { path: 'worker/order.py', name: 'deliver' },
    ]);
    first[Symbol.dispose]();
    expect(deletion).not.toHaveBeenCalled();
    resources.dispose();
    expect(deletion).toHaveBeenCalledTimes(1);
    using nextResources = new DisposableStack();
    using next = await visitParsed({ ...input, resources: nextResources }, readPython, disposePython);
    expect(next.value).not.toBe(first.value);
    expect(next.value.modules[0]!.tree.rootNode.text).toBe(PYTHON_SOURCES['api/order.py']);
});

test('standalone Python readers dispose selected trees after both success and failure', async () => {
    await using sandbox = await testdir(PYTHON_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    const input = {
        root: sandbox.path,
        reads,
        files: [
            { path: 'api/order.py', kind: 'source' },
            { path: 'worker/order.py', kind: 'source' },
            { path: 'generated/order.py', kind: 'generated' },
            { path: 'api/readme.md', kind: 'source' },
        ],
    };
    using deletion = spyOn(Tree.prototype, 'delete');
    {
        using parsed = await visitParsed(input, readPython, disposePython);
        await Promise.resolve();
        expect(parsed.value.functions.map(({ name }) => name)).toStrictEqual(['total', 'lambda', 'deliver']);
        expect(deletion).not.toHaveBeenCalled();
    }
    expect(deletion).toHaveBeenCalledTimes(2);
    deletion.mockClear();
    expect(
        await rejection(
            (async () => {
                using parsed = await visitParsed(input, readPython, disposePython);
                expect(parsed.value.modules.map(({ path }) => path)).toStrictEqual(['api/order.py', 'worker/order.py']);
                throw new Error('The Python reader failed.');
            })(),
        ),
    ).toBe('The Python reader failed.');
    expect(deletion).toHaveBeenCalledTimes(2);
});
