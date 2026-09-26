import { tmpdir } from 'node:os';
import { expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { startRegistry } from '#tests/support/registry/lifecycle.ts';
import { rejection } from '#tests/support/rejection.ts';

test('registry setup releases storage after bind failure, timeout, and interruption', async () => {
    const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-release-')));
    let requests = 0;
    const unrelated = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch() {
            requests += 1;
            return new Response('{}');
        },
    });
    try {
        expect((await rejection(startRegistry(unrelated.port))).message).toContain('Registry startup failed');
        expect(requests).toBe(0);
        expect((await rejection(startRegistry(0, 1))).message).toContain('Registry startup failed');
        const controller = new AbortController();
        const starting = startRegistry(0, 30_000, controller.signal);
        controller.abort(new Error('Interrupted setup'));
        expect((await rejection(starting)).message).toContain('Interrupted setup');
        expect(new Set(readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-release-')))).toStrictEqual(
            before,
        );
    } finally {
        await unrelated.stop(true);
    }
});

test('registry shutdown removes storage after cancellation and refuses further publication', async () => {
    const controller = new AbortController();
    const registry = await startRegistry(0, 30_000, controller.signal);
    try {
        expect((await fetch(`${registry.url}/-/ping`)).status).toBe(200);
        controller.abort();
    } finally {
        await registry.stop();
    }
    expect(existsSync(registry.work)).toBe(false);
    expect(() => {
        registry.assertRunning();
    }).toThrow('Registry is no longer running');
});
