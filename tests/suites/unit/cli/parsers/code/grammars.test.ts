import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';

test('parsed source copies remain usable after the run releases its resources', async () => {
    const cache = createRunCache(process.cwd());
    const source = 'const counter: number = 1;';
    using copies = new DisposableStack();
    using resources = new DisposableStack();
    const typescript = copies.use(await parseSource('typescript', source, { cache, resources }));
    const javascript = copies.use(await parseSource('javascript', source, { cache, resources }));
    const repeated = copies.use(await parseSource('typescript', source, { cache, resources }));
    expect(typescript.rootNode.hasError).toBe(false);
    expect(javascript.rootNode.hasError).toBe(true);
    expect(repeated.rootNode.text).toBe(source);
    resources.dispose();
    expect(typescript.rootNode.text).toBe(source);
});
