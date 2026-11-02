import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { createRunResources } from '#tests/setup/cli/run.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const cache = createRunCache(process.cwd());
    const source = 'const counter: number = 1;';
    using copies = new DisposableStack();
    using resources = createRunResources();
    const typescript = copies.use(await parseSource('typescript', source, { cache, resources }));
    const javascript = copies.use(await parseSource('javascript', source, { cache, resources }));
    const repeated = copies.use(await parseSource('typescript', source, { cache, resources }));
    expect(typescript.rootNode.hasError).toBe(false);
    expect(javascript.rootNode.hasError).toBe(true);
    expect(repeated.rootNode.text).toBe(source);
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
