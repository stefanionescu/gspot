import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';

test('a missing folder keeps its ENOENT error', async () => {
    await using sandbox = await testdir();
    const failure: unknown = await Promise.resolve()
        .then(() => openFiles(join(sandbox.path, 'missing')))
        .catch((error: unknown) => error);
    expect(failure).toMatchObject({
        code: 'ENOENT',
    });
});
