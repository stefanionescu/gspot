import * as fs from 'node:fs';
import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { publishTo, startRegistry } from '#tests/harness/registry/lifecycle.ts';

// Observe owned resources at their external boundaries, including failed setup.
async function failedStartup(action: () => Promise<unknown>): Promise<Error> {
    const directories = spyOn(fs, 'mkdtempSync');
    const children = spyOn(Bun, 'spawn');
    try {
        let failure: unknown;
        try {
            await action();
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        for (const result of directories.mock.results) {
            if (result.type === 'return') expect(fs.existsSync(result.value)).toBe(false);
        }
        for (const result of children.mock.results) {
            if (result.type === 'return')
                expect(result.value.exitCode !== null || result.value.signalCode !== null).toBe(true);
        }
        return failure as Error;
    } finally {
        directories.mockRestore();
        children.mockRestore();
    }
}

test('an occupied healthy port cannot become the release registry', async () => {
    let requests = 0;
    const unrelated = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        fetch() {
            requests += 1;
            return new Response('{}');
        },
    });
    try {
        const failure = await failedStartup(() => startRegistry(unrelated.port));
        expect((failure.cause as Error).message).toContain('exited');
        expect(failure.message).toContain('Registry startup failed.');
        expect(requests).toBe(0);
    } finally {
        await unrelated.stop(true);
    }
});

test('parallel registries own separate ports and await normal shutdown', async () => {
    const first = await startRegistry();
    try {
        const second = await startRegistry();
        try {
            expect(first.url).not.toBe(second.url);
            expect(first.work).not.toBe(second.work);
            for (const registry of [first, second]) {
                const response = await fetch(`${registry.url}/-/ping`, { signal: AbortSignal.timeout(1000) });
                expect(response.ok).toBe(true);
                expect(fs.readFileSync(registry.npmrc, 'utf8')).toContain(registry.url);
            }
        } finally {
            await second.stop();
        }
        expect(fs.existsSync(second.work)).toBe(false);
    } finally {
        await first.stop();
    }
    expect(fs.existsSync(first.work)).toBe(false);
    expect(() => publishTo(first)).toThrow('no longer running');
});

test('startup timeout stops the child and removes its storage', async () => {
    const failure = await failedStartup(() => startRegistry(0, 1));
    expect((failure.cause as Error).message).toContain('startup timed out');
});

test('a missing executable cleans the work directory before rejecting', async () => {
    const spawn = Bun.spawn.bind(Bun);
    await failedStartup(async () => {
        const probe = spyOn(Bun, 'spawn').mockImplementationOnce(() =>
            spawn([join(import.meta.dir, 'missing-registry-executable')], { stdout: 'pipe', stderr: 'pipe' }),
        );
        try {
            await startRegistry();
        } finally {
            probe.mockRestore();
        }
    });
});

test('early child exit preserves diagnostics and cleans owned resources', async () => {
    const write = fs.writeFileSync;
    const probe = spyOn(fs, 'writeFileSync').mockImplementationOnce((path) => {
        write(path, 'storage: [invalid');
    });
    try {
        const failure = await failedStartup(() => startRegistry());
        expect(failure.message).toContain('not look like a valid config file');
        expect((failure.cause as Error).message).toContain('exited');
    } finally {
        probe.mockRestore();
    }
});

test('a stalled readiness request is aborted and releases the child', async () => {
    const probe = spyOn(globalThis, 'fetch').mockImplementationOnce(
        Object.assign(
            (_url: string | URL | Request, options?: RequestInit): Promise<Response> =>
                new Promise((_, reject) => {
                    options?.signal?.addEventListener(
                        'abort',
                        () => {
                            reject(new DOMException('Readiness deadline elapsed.', 'TimeoutError'));
                        },
                        { once: true },
                    );
                }),
            { preconnect: fetch.preconnect },
        ),
    );
    try {
        const failure = await failedStartup(() => startRegistry());
        expect((failure.cause as Error).name).toBe('TimeoutError');
    } finally {
        probe.mockRestore();
    }
});

test.each(['verdaccio.yaml', '.npmrc'])('a failed %s write cleans partial setup', async (filename) => {
    const write = fs.writeFileSync;
    const probe = spyOn(fs, 'writeFileSync').mockImplementation((path, ...args) => {
        if (String(path).endsWith(filename)) throw new Error('Planted write failure.');
        write(path, ...args);
    });
    try {
        const failure = await failedStartup(() => startRegistry());
        const original = failure.cause ?? failure;
        expect((original as Error).message).toContain('Planted write failure');
    } finally {
        probe.mockRestore();
    }
});
