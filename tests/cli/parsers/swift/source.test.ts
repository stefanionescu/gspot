import { testdir } from 'testdirs';
import { Tree } from 'web-tree-sitter';
import { test, spyOn, expect } from 'bun:test';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import { parseTestSource } from '#tests/harness/syntax.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { SWIFT_SOURCES } from '#tests/config/cli/parsers/tree-sitter.ts';
import { ACCESSOR_DECLARATIONS } from '#tests/config/samples/swift/source.ts';
import { readSwift, disposeSwift, getSwiftFunctions } from '#cli/parsers/swift/source.ts';

test('Swift observations reuse selected paths while isolating scopes and resource owners', async () => {
    await using sandbox = await testdir(SWIFT_SOURCES);
    const reads: ReadCache = { root: sandbox.path, sources: new Map(), memo: new Map() };
    using resources = new DisposableStack();
    const input = { root: sandbox.path, reads, resources, files: [{ path: 'app/Order.swift', kind: 'source' }] };
    using first = await visitParsed(input, readSwift, disposeSwift);
    using deletion = spyOn(first.value.sources[0]!.tree, 'delete');
    expect(first.value.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
        { path: 'app/Order.swift', name: 'total' },
        { path: 'app/Order.swift', name: 'closure' },
    ]);
    const selectedFiles = input.files.map((file) => ({ ...file, prefix: Buffer.from('changed metadata') }));
    using repeated = await visitParsed(
        {
            ...input,
            files: selectedFiles,
        },
        readSwift,
        disposeSwift,
    );
    expect(repeated.value).toBe(first.value);
    expect(repeated.value.sources[0]!.tree.rootNode.text).toBe(SWIFT_SOURCES['app/Order.swift']);
    using scoped = await visitParsed(
        { ...input, files: [{ path: 'worker/Order.swift', kind: 'source' }] },
        readSwift,
        disposeSwift,
    );
    expect(scoped.value).not.toBe(first.value);
    expect(scoped.value.functions.map(({ path, name }) => ({ path, name }))).toStrictEqual([
        { path: 'worker/Order.swift', name: 'deliver' },
    ]);
    first[Symbol.dispose]();
    expect(deletion).not.toHaveBeenCalled();
    resources.dispose();
    expect(deletion).toHaveBeenCalledTimes(1);
    using nextResources = new DisposableStack();
    using next = await visitParsed({ ...input, resources: nextResources }, readSwift, disposeSwift);
    expect(next.value).not.toBe(first.value);
    expect(next.value.sources[0]!.tree.rootNode.text).toBe(SWIFT_SOURCES['app/Order.swift']);
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
            { path: 'generated/order.swift', kind: 'generated' },
            { path: 'api/readme.md', kind: 'source' },
        ],
    };
    using deletion = spyOn(Tree.prototype, 'delete');
    {
        using parsed = await visitParsed(input, readSwift, disposeSwift);
        await Promise.resolve();
        expect(parsed.value.functions.map(({ name }) => name)).toStrictEqual(['total', 'closure', 'deliver']);
        expect(deletion).not.toHaveBeenCalled();
    }
    expect(deletion).toHaveBeenCalledTimes(2);
    deletion.mockClear();
    expect(
        await rejection(
            (async () => {
                using parsed = await visitParsed(input, readSwift, disposeSwift);
                expect(parsed.value.sources.map(({ path }) => path)).toStrictEqual([
                    'app/Order.swift',
                    'worker/Order.swift',
                ]);
                throw new Error('The Swift reader failed.');
            })(),
        ),
    ).toBe('The Swift reader failed.');
    expect(deletion).toHaveBeenCalledTimes(2);
});

test('Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place', async () => {
    const text = ACCESSOR_DECLARATIONS;
    using tree = await parseTestSource('swift', text);

    const functions = getSwiftFunctions({ path: 'example.swift', text, lines: text.split('\n'), tree });
    expect(functions.map(({ name }) => name)).toStrictEqual([
        'init',
        'getter of value',
        'setter of value',
        'method',
        'outer',
        'inner',
        'closure',
    ]);
});
