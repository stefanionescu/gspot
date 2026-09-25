import { expect, spyOn, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testdir } from 'testdirs';
import { prepareInput, SWIFT_GRAMMAR } from '../../../packages/cli/build/inputs.ts';

const bytes = readFileSync(fileURLToPath(new URL('../../../packages/cli/.build/swift.wasm', import.meta.url)));

test('verified upstream grammar is cached and reused without another download', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'build/swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toEqual(bytes);
    download.mockRejectedValue(new Error('Cached preparation must not use the network.'));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toEqual(bytes);
});

test('a corrupted download never becomes a cached parser', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'build/swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('corrupted grammar'));
    await expect(prepareInput(path, SWIFT_GRAMMAR)).rejects.toThrow('checksum mismatch');
    expect(existsSync(join(sandbox.path, 'build'))).toBe(false);
    download.mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toEqual(bytes);
});

test('a corrupt cache is refused without replacing it or making a network request', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'swift.wasm');
    await Bun.write(path, 'corrupted cache');
    using download = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected download.'));
    await expect(prepareInput(path, SWIFT_GRAMMAR)).rejects.toThrow('checksum mismatch');
    expect(readFileSync(path, 'utf8')).toBe('corrupted cache');
    expect(download).not.toHaveBeenCalled();
});

test('an upstream HTTP failure leaves no parser and a corrected response prepares it', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'swift.wasm');
    using download = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(prepareInput(path, SWIFT_GRAMMAR)).rejects.toThrow('HTTP 503');
    expect(existsSync(path)).toBe(false);
    download.mockResolvedValue(new Response(bytes));
    await prepareInput(path, SWIFT_GRAMMAR);
    expect(readFileSync(path)).toEqual(bytes);
});
