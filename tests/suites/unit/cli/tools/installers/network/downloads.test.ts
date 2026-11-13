import http from 'node:http';

import { expect, spyOn, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { downloadArchive } from '#cli/tools/installers/network/downloads.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

async function captureDownloadRejection(response: Response): Promise<Error> {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    using _request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(response), { preconnect: fetch.preconnect }),
    );
    return await captureRejection(
        downloadArchive(install.session, {
            url: 'https://example.com/styles.zip',
            name: 'styles',
            limit: 2,
            sha256: '',
            refusal: '',
        }),
    );
}

test('an oversized archive cancels its response stream before reporting the size error', async () => {
    let isCanceled = false;
    const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
            controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel: () => {
            isCanceled = true;
        },
    });
    const error = await captureDownloadRejection(new Response(stream));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('https://example.com/styles.zip');
    expect(isCanceled).toBe(true);
});

test('a failed download behind a proxy says how to turn the proxy on', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    using _environment = overrideEnvironment({ HTTPS_PROXY: 'https://proxy.example.com:8080' });
    const refuse = Object.assign(() => Promise.reject(new Error('The proxy refused the connection.')), {
        preconnect: fetch.preconnect,
    });
    using _fetch = spyOn(globalThis, 'fetch').mockImplementation(refuse);
    const setProxy: unknown = Reflect.get(http, 'setGlobalProxyFromEnv');
    using restore = new DisposableStack();
    restore.defer(() => Reflect.set(http, 'setGlobalProxyFromEnv', setProxy));
    Reflect.deleteProperty(http, 'setGlobalProxyFromEnv');
    const failure = await captureRejection(
        downloadArchive(install.session, {
            url: 'https://example.com/a.zip',
            name: 'the archive',
            limit: 1,
            sha256: '',
            refusal: '',
        }),
    );
    expect(failure).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(failure.message).toContain('NODE_USE_ENV_PROXY=1');
});

test('a download that answers 404 names the status and the URL', async () => {
    const error = await captureDownloadRejection(new Response('', { status: 404 }));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('HTTP 404');
    expect(error.message).toContain('https://example.com/styles.zip');
});
