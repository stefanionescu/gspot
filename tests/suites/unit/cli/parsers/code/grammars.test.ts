import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const cache = createRunCache(process.cwd());
    const source = 'const counter: number = 1;';
    using copies = new DisposableStack();
    using resources = createRunResources();
    const typescript = copies.use(await parseSource('typescript', source, { cache, resources }));
    const javascript = copies.use(await parseSource('javascript', source, { cache, resources }));
    expect(typescript.rootNode.hasError).toBe(false);
    expect(javascript.rootNode.hasError).toBe(true);
    resources[Symbol.dispose]();
    expect(typescript.rootNode.text).toBe(source);
});

test('a long parse pass lets the event loop run', async () => {
    using _loaded = await parseSource('bash', 'echo ready\n');
    let hasLoopRun = false;
    setImmediate(() => {
        hasLoopRun = true;
    });
    for (let parsed = 0; parsed < 200; parsed += 1) {
        using _tree = await parseSource('bash', 'echo ready\n');
    }
    expect(hasLoopRun).toBe(true);
});

test('a damaged grammar names its file and the command that restores it', async () => {
    await using cache = await testdir({ 'gspot/grammars/python.wasm': 'damaged' });
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    const error = await captureRejection(parseSource('python', 'value = 1\n'));
    expect(error).toMatchObject({ name: 'GspotError', code: 'tool' });
    expect(error.message).toContain(join(cache.path, 'gspot/grammars/python.wasm'));
    expect(error.message).toContain('gspot install');
});
