import { test, expect } from 'bun:test';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const reads = createReadCache(process.cwd());
    const source = 'const counter: number = 1;';
    using copies = new DisposableStack();
    using resources = new DisposableStack();
    const typescript = copies.use(await parseSource('typescript', source, { reads, resources }));
    const javascript = copies.use(await parseSource('javascript', source, { reads, resources }));
    const repeated = copies.use(await parseSource('typescript', source, { reads, resources }));
    expect(typescript.rootNode.hasError).toBe(false);
    expect(javascript.rootNode.hasError).toBe(true);
    expect(repeated.rootNode.text).toBe(source);
    resources.dispose();
    expect(typescript.rootNode.text).toBe(source);
});
