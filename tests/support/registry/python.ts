import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { RUFF_WHEEL } from '#tests/constants/integration/tools/python.ts';

/** Serves a wheel containing the pinned Ruff executable and a relocatable console entry point. */
export async function createPythonRegistry(
    work: string,
): Promise<{ pinned: string; url: string; [Symbol.asyncDispose](): Promise<void> }> {
    const binary = Bun.which('ruff');
    if (binary === null) throw new Error('The pinned Ruff executable is unavailable.');
    const version = await run([binary, '--version'], { cwd: work });
    if (version.code !== 0) throw new Error(`Ruff fixture version failed: ${version.stderr}`);
    const pinned = version.stdout.trim().split(' ', 2)[1]!;
    const wheel = `ruff-${pinned}-py3-none-any.whl`;
    const packed = await run(['python3', '-c', RUFF_WHEEL, binary, join(work, wheel), pinned], { cwd: work });
    if (packed.code !== 0) throw new Error(`Ruff fixture packaging failed: ${packed.stderr}`);
    const archive = readFileSync(join(work, wheel));
    const digest = createHash('sha256').update(archive).digest('hex');
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (
                request.headers.get('authorization') !==
                `Basic ${Buffer.from('gspot:synthetic-uv-password').toString('base64')}`
            )
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                headers: { 'content-type': 'text/html' },
            });
        },
    });
    return {
        pinned,
        url: `http://gspot:synthetic-uv-password@127.0.0.1:${String(server.port)}/simple`,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}
