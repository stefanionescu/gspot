import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { SHARED_GRAMMARS } from '#tests/setup/runner/run-folder.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

function serveGrammar(request: Parameters<typeof fetch>[0]): Promise<Response> {
    const address = request instanceof Request ? request.url : request.toString();
    const name = address.includes('html') ? 'html.wasm' : 'bash.wasm';
    const bytes = readFileSync(join(SHARED_GRAMMARS, name));
    return Promise.resolve(new Response(bytes));
}

test('install downloads the grammars of the repository once, and refuses other bytes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'entry.sh': 'echo a\n' });
    await using cache = await testdir();
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response('other bytes')), { preconnect: fetch.preconnect }),
    );
    const refused = await captureRejection(installGrammars(install));
    expect(refused).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(refused.message).toContain('bash');
    expect(existsSync(join(cache.path, 'gspot/grammars/bash.wasm'))).toBe(false);
    request.mockImplementation(Object.assign(serveGrammar, { preconnect: fetch.preconnect }));
    expect(await installGrammars(install)).toBe('installed 2 grammars');
    expect(existsSync(join(cache.path, 'gspot/grammars/bash.wasm'))).toBe(true);
    expect(await installGrammars(install)).toBe('');
});

test('install downloads the HTML grammar for Markdown, because gspot/suppressions reads it in every repository', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'README.md': '# Title\n' });
    await using cache = await testdir();
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const bytes = readFileSync(join(SHARED_GRAMMARS, 'html.wasm'));
    using _request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response(bytes)), { preconnect: fetch.preconnect }),
    );
    expect(await installGrammars(install)).toBe('installed 1 grammar');
    expect(existsSync(join(cache.path, 'gspot/grammars/html.wasm'))).toBe(true);
});
