import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { openSession } from '#cli/engine/session.ts';
import { planInit } from '#cli/generation/setup/planner.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { SHARED_GRAMMARS } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

function serveGrammar(request: Parameters<typeof fetch>[0]): Promise<Response> {
    const address = request instanceof Request ? request.url : request.toString();
    const name = ['html', 'swift'].find((grammar) => address.includes(grammar)) ?? 'bash';
    const bytes = readFileSync(join(SHARED_GRAMMARS, `${name}.wasm`));
    return Promise.resolve(new Response(bytes));
}

test.each([
    { command: 'gspot check', read: (path: string) => openSession(path) },
    { command: 'gspot init', read: (path: string) => planInit(path, {}) },
])('$command downloads the Swift grammar before it reads a Swift file', async ({ read }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'App.swift': 'import Foo\n',
    });
    await using cache = await testdir();
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    using _request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(serveGrammar, { preconnect: fetch.preconnect }),
    );
    await read(sandbox.path);
    expect(existsSync(join(cache.path, 'gspot/grammars/swift.wasm'))).toBe(true);
});

test('install downloads the grammars of the repository once, and refuses other bytes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'entry.sh': 'echo a\n' });
    await using cache = await testdir();
    using _environment = overrideEnvironment({ XDG_CACHE_HOME: cache.path });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
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
