import { testdir } from 'testdirs';
import { Tree } from 'web-tree-sitter';
import { test, spyOn, expect } from 'bun:test';
import { rejection } from '#tests/harness/expectations.ts';
import { visitPythonModules } from '#cli/parsers/python.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { PYTHON_SOURCES } from '#tests/config/cli/parsers/python.ts';

test('Python observations are shared within one owner and remain isolated between scopes', async () => {
    await using sandbox = await testdir(PYTHON_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    const resources = new DisposableStack();
    using spies = new DisposableStack();
    const input = { root: sandbox.path, reads, resources, files: [{ path: 'api/order.py', kind: 'source' }] };
    try {
        const first = await visitPythonModules(input, (parsed) => ({
            parsed,
            deletion: spies.use(spyOn(parsed.modules[0]!.tree, 'delete')),
        }));
        expect(first.parsed.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
            { path: 'api/order.py', name: 'total' },
            { path: 'api/order.py', name: 'lambda' },
        ]);
        await visitPythonModules(input, (parsed) => {
            expect(parsed).toBe(first.parsed);
            expect(parsed.modules[0]!.tree.rootNode.text).toBe(PYTHON_SOURCES['api/order.py']);
        });
        await visitPythonModules({ ...input, files: [{ path: 'worker/order.py', kind: 'source' }] }, (parsed) => {
            expect(parsed).not.toBe(first.parsed);
            expect(parsed.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
                { path: 'worker/order.py', name: 'deliver' },
            ]);
        });
        expect(first.deletion).not.toHaveBeenCalled();
        resources.dispose();
        expect(first.deletion).toHaveBeenCalledTimes(1);
        using nextResources = new DisposableStack();
        await visitPythonModules({ ...input, resources: nextResources }, (parsed) => {
            expect(parsed).not.toBe(first.parsed);
            expect(parsed.modules[0]!.tree.rootNode.text).toBe(PYTHON_SOURCES['api/order.py']);
        });
    } finally {
        resources.dispose();
    }
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
    const names = await visitPythonModules(input, async ({ functions }) => {
        await Promise.resolve();
        return functions.map(({ name }) => name);
    });
    expect(names).toStrictEqual(['total', 'lambda', 'deliver']);
    expect(deletion).toHaveBeenCalledTimes(2);
    deletion.mockClear();
    expect(
        await rejection(
            visitPythonModules(input, ({ modules }) => {
                expect(modules.map(({ path }) => path)).toStrictEqual(['api/order.py', 'worker/order.py']);
                throw new Error('The Python reader failed.');
            }),
        ),
    ).toBe('The Python reader failed.');
    expect(deletion).toHaveBeenCalledTimes(2);
});
