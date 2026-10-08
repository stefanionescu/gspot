import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { trackedEntries } from '#cli/repository/contracts.ts';

test.skipIf(!isPosix)('a non-Git walk omits named pipes from readable source files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.runBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const entries = await trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
});
