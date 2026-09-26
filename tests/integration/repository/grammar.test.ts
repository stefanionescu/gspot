import { join } from 'node:path';
import { testdir } from 'testdirs';
import { fileURLToPath } from 'node:url';
import { expect, spyOn, test } from 'bun:test';
import { prepareInput } from '#scripts/inputs.ts';
import { existsSync, readFileSync } from 'node:fs';
import { SWIFT_GRAMMAR } from '#cli/platform/assets.ts';
import { rejection } from '#tests/support/expectations.ts';

const bytes = readFileSync(fileURLToPath(new URL('../../../packages/cli/.build/swift.wasm', import.meta.url)));

test('verified upstream grammar is cached and reused without another download', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'build/swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toStrictEqual(bytes);
    download.mockRejectedValue(new Error('Cached preparation must not use the network.'));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toStrictEqual(bytes);
});

test('a corrupted download never becomes a cached parser', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'build/swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('corrupted grammar'));
    expect((await rejection(prepareInput(path, SWIFT_GRAMMAR))).message).toContain('checksum mismatch');
    expect(existsSync(join(sandbox.path, 'build'))).toBe(false);
    download.mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toStrictEqual(bytes);
});

test('a corrupt cache is refused without replacing it or making a network request', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'swift.wasm');
    await Bun.write(path, 'corrupted cache');
    using download = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected download.'));
    expect((await rejection(prepareInput(path, SWIFT_GRAMMAR))).message).toContain('checksum mismatch');
    expect(readFileSync(path, 'utf8')).toBe('corrupted cache');
    expect(download).not.toHaveBeenCalled();
});

test('an upstream HTTP failure leaves no parser and a corrected response prepares it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    expect((await rejection(prepareInput(path, SWIFT_GRAMMAR))).message).toContain('HTTP 503');
    expect(existsSync(path)).toBe(false);
    download.mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toStrictEqual(bytes);
});
