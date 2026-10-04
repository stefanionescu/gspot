import { testdir } from 'testdirs';
import { Tree } from 'web-tree-sitter';
import { test, spyOn, expect } from 'bun:test';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { SWIFT_SOURCES } from '#tests/config/cli/parsers/swift.ts';

test('Swift observations are shared within one owner and remain isolated between scopes', async () => {
    await using sandbox = await testdir(SWIFT_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    const resources = new DisposableStack();
    using spies = new DisposableStack();
    const input = { root: sandbox.path, reads, resources, files: [{ path: 'app/Order.swift', kind: 'source' }] };
    try {
        const first = await visitSwiftSources(input, (parsed) => ({
            parsed,
            deletion: spies.use(spyOn(parsed.sources[0]!.tree, 'delete')),
        }));
        expect(first.parsed.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
            { path: 'app/Order.swift', name: 'total' },
            { path: 'app/Order.swift', name: 'closure' },
        ]);
        await visitSwiftSources(input, (parsed) => {
            expect(parsed).toBe(first.parsed);
            expect(parsed.sources[0]!.tree.rootNode.text).toBe(SWIFT_SOURCES['app/Order.swift']);
        });
        await visitSwiftSources({ ...input, files: [{ path: 'worker/Order.swift', kind: 'source' }] }, (parsed) => {
            expect(parsed).not.toBe(first.parsed);
            expect(parsed.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
                { path: 'worker/Order.swift', name: 'deliver' },
            ]);
        });
        expect(first.deletion).not.toHaveBeenCalled();
        resources.dispose();
        expect(first.deletion).toHaveBeenCalledTimes(1);
        using nextResources = new DisposableStack();
        await visitSwiftSources({ ...input, resources: nextResources }, (parsed) => {
            expect(parsed).not.toBe(first.parsed);
            expect(parsed.sources[0]!.tree.rootNode.text).toBe(SWIFT_SOURCES['app/Order.swift']);
        });
    } finally {
        resources.dispose();
    }
});

test('standalone Swift readers dispose selected trees after both success and failure', async () => {
    await using sandbox = await testdir(SWIFT_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    const input = {
        root: sandbox.path,
        reads,
        files: [
            { path: 'app/Order.swift', kind: 'source' },
            { path: 'worker/Order.swift', kind: 'source' },
            { path: 'generated/Order.swift', kind: 'generated' },
            { path: 'app/readme.md', kind: 'source' },
        ],
    };
    using deletion = spyOn(Tree.prototype, 'delete');
    const names = await visitSwiftSources(input, async ({ functions }) => {
        await Promise.resolve();
        return functions.map(({ name }) => name);
    });
    expect(names).toStrictEqual(['total', 'closure', 'deliver']);
    expect(deletion).toHaveBeenCalledTimes(2);
    deletion.mockClear();
    expect(
        await rejection(
            visitSwiftSources(input, ({ sources }) => {
                expect(sources.map(({ path }) => path)).toStrictEqual(['app/Order.swift', 'worker/Order.swift']);
                throw new Error('The Swift reader failed.');
            }),
        ),
    ).toBe('The Swift reader failed.');
    expect(deletion).toHaveBeenCalledTimes(2);
});
