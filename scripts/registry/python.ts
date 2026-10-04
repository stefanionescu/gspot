import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { PythonRegistry, RegistryCommand } from '#automation/types/registry.ts';

import {
    RUFF_WHEEL,
    RUFF_VERSION_OUTPUT,
    REGISTRY_PACK_TIMEOUT_MS,
    PYTHON_REGISTRY_CREDENTIALS,
} from '#automation/config/registry.ts';

/**
 * Serve a wheel containing Ruff from PATH and a relocatable console entry point.
 * @param work the temporary folder receiving the wheel
 * @param execute the caller's bounded command runner
 * @returns an authenticated registry serving the wheel
 */
export async function createPythonRegistry(work: string, execute: RegistryCommand): Promise<PythonRegistry> {
    const binary = Bun.which('ruff');
    if (binary === null) throw new Error('Ruff is unavailable on PATH.');
    const inspected = await execute([binary, '--version'], { cwd: work, timeoutMs: REGISTRY_PACK_TIMEOUT_MS });
    if (inspected.code !== 0) throw new Error(`Ruff fixture version failed: ${inspected.stderr}`);
    const version = RUFF_VERSION_OUTPUT.exec(inspected.stdout.trim())?.groups?.['version'];
    if (version === undefined) throw new Error('Ruff fixture version output is invalid.');
    const wheel = `ruff-${version}-py3-none-any.whl`;
    const packed = await execute(['python3', '-c', RUFF_WHEEL, binary, join(work, wheel), version], {
        cwd: work,
        timeoutMs: REGISTRY_PACK_TIMEOUT_MS,
    });
    if (packed.code !== 0) throw new Error(`Ruff fixture packaging failed: ${packed.stderr}`);
    const archive = readFileSync(join(work, wheel));
    const digest = createHash('sha256').update(archive).digest('hex');
    const { user, password } = PYTHON_REGISTRY_CREDENTIALS;
    const credentials = `${user}:${password}`;
    const authentication = `Basic ${Buffer.from(credentials).toString('base64')}`;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== authentication)
                return new Response('Authentication required', { status: 401 });
            if (new URL(request.url).pathname.endsWith('.whl')) return new Response(archive);
            return new Response(`<a href="/${wheel}#sha256=${digest}">${wheel}</a>`, {
                headers: { 'content-type': 'text/html' },
            });
        },
    });
    return {
        version,
        url: `http://${user}:${password}@127.0.0.1:${String(server.port)}/simple`,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}
