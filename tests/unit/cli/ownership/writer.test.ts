import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { planReplacement } from '#cli/ownership/plans.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';

test('one batch writes the planned binary bytes and removes an obsolete file', async () => {
    await using sandbox = await testdir();
    using writer = openWriter(sandbox.path);
    const first = Buffer.from([0, 255, 10]);
    const second = Buffer.from([255, 0, 13]);
    writePlans(writer, [
        planReplacement(writer, { path: '.gspot/first.bin', next: { bytes: first, mode: 0o644 } }),
        planReplacement(writer, { path: '.gspot/second.bin', next: { bytes: second, mode: 0o644 } }),
    ]);
    expect(await readFile(join(sandbox.path, '.gspot/first.bin'))).toStrictEqual(first);
    expect(await readFile(join(sandbox.path, '.gspot/second.bin'))).toStrictEqual(second);
    writePlans(writer, [
        { path: '.gspot/first.bin', before: writer.files.read('.gspot/first.bin'), status: 'changed' },
    ]);
    expect(writer.files.readStats('.gspot/first.bin')).toBeUndefined();
    expect(await readFile(join(sandbox.path, '.gspot/second.bin'))).toStrictEqual(second);
});
