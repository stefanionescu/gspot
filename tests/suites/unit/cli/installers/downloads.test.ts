import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { downloadArchive } from '#cli/installers/downloads.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('an oversized archive cancels its response stream before reporting the size error', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
            controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel: () => {
            canceled = true;
        },
    });
    using request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response(stream)), { preconnect: fetch.preconnect }),
    );
    const error = await captureRejection(
        downloadArchive(install, {
            url: 'https://example.com/styles.zip',
            name: 'styles',
            limit: 2,
        }),
    );
    expect(error).toMatchObject({
        code: 'install',
        message: 'https://example.com/styles.zip exceeds the size limit for styles.',
    });
    expect(canceled).toBe(true);
    expect(stream.locked).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
});
