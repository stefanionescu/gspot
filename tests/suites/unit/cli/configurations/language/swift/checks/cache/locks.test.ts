import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { acquireBuildLock } from '#cli/configurations/language/swift/checks/cache.ts';

async function createLockedFolder(): Promise<string> {
    const folder = join(readCacheFolder(), 'scope');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'build.lock'), '1');
    return folder;
}

test('a build lock holds this process ID until disposal', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = join(readCacheFolder(), 'scope');
    const lock = await acquireBuildLock(folder, undefined);
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe(String(process.pid));
    lock[Symbol.dispose]();
    expect(existsSync(join(folder, 'build.lock'))).toBe(false);
});

test('a build replaces the lock of a stopped process', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = await createLockedFolder();
    using _stopped = spyOn(processes, 'isProcessRunning').mockReturnValue(false);
    using _lock = await acquireBuildLock(folder, undefined);
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe(String(process.pid));
});

test('a build waits for the lock of a running process until the run stops', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = await createLockedFolder();
    using _running = spyOn(processes, 'isProcessRunning').mockReturnValue(true);
    const stopped = await captureRejection(acquireBuildLock(folder, AbortSignal.abort()));
    expect(stopped.name).toBe('AbortError');
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe('1');
});
