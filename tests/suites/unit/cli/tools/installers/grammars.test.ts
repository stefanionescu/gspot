import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SHARED_GRAMMARS } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('install downloads the grammars of the repository once, and refuses other bytes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'entry.sh': 'echo a\n' });
    await using cache = await testdir();
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    const install = buildToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const bytes = readFileSync(join(SHARED_GRAMMARS, 'bash.wasm'));
    using request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response('other bytes')), { preconnect: fetch.preconnect }),
    );
    const refused = await captureRejection(installGrammars(install));
    expect(refused.message).toBe('The bash grammar failed SHA-256 verification.');
    expect(await isOnDisk(join(cache.path, 'gspot/grammars/bash.wasm'))).toBe(false);
    request.mockImplementation(
        Object.assign(() => Promise.resolve(new Response(bytes)), { preconnect: fetch.preconnect }),
    );
    expect(await installGrammars(install)).toBe('installed 1 grammar');
    expect(await isOnDisk(join(cache.path, 'gspot/grammars/bash.wasm'))).toBe(true);
    expect(await installGrammars(install)).toBe('');
});
