// An owned Verdaccio child with an isolated socket and storage for source acceptance and release tests.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Registry } from '#tests/types/registry.ts';
import { rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { REQUEST_MS, STARTUP_MS, SHUTDOWN_MS } from '#tests/config/timeouts.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const serverEntry = fileURLToPath(new URL('server.ts', import.meta.url));
async function bounded<T>(operation: Promise<T>, milliseconds: number, errorText: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(errorText));
        }, milliseconds);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

async function ping(url: string, signal: AbortSignal): Promise<void> {
    const response = await fetch(`${url}/-/ping`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_MS)]),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Registry readiness failed: HTTP ${String(response.status)}.`);
}

function launch(config: string, port: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const address = Promise.withResolvers<number>();
    // Verdaccio's proxy fails TLS under Bun, so the registry runs under Node.
    const server = Bun.spawn(['node', serverEntry, config, String(port)], {
        cwd: root,
        serialization: 'json',
        stdout: 'pipe',
        stderr: 'pipe',
        ipc(packet: unknown) {
            if (typeof packet !== 'object' || packet === null || !('port' in packet)) return;
            if (typeof packet.port === 'number') address.resolve(packet.port);
        },
    });
    const cancel = () => {
        address.reject(signal.reason);
        if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
    };
    signal.addEventListener('abort', cancel, { once: true });
    const output = Promise.all([new Response(server.stdout).text(), new Response(server.stderr).text()]);
    const exited = server.exited.then((code) => {
        throw new Error(`Registry exited with status ${String(code)}.`);
    });
    const ready = (async () => {
        const assignedPort = await Promise.race([address.promise, exited]);
        const url = `http://127.0.0.1:${String(assignedPort)}`;
        await Promise.race([ping(url, signal), exited]);
        return url;
    })();
    async function stop(): Promise<void> {
        signal.removeEventListener('abort', cancel);
        if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
        const results = await Promise.allSettled([
            bounded(server.exited, SHUTDOWN_MS, 'Registry shutdown timed out.'),
            bounded(output, SHUTDOWN_MS, 'Registry output drain timed out.'),
        ]);
        const failures = results
            .filter((result) => result.status === 'rejected')
            .map((result): unknown => result.reason);
        if (failures.length > 0) throw new AggregateError(failures, 'Registry cleanup failed.');
    }
    return { ready, stop, output, server };
}

async function configure(work: string): Promise<string> {
    const config = join(work, 'verdaccio.yaml');
    const template = await Bun.file(fileURLToPath(new URL('config.yaml', import.meta.url))).text();
    writeFileSync(
        config,
        template
            .replace('./storage', () => JSON.stringify(join(work, 'storage')))
            .replace('./htpasswd', () => JSON.stringify(join(work, 'htpasswd'))),
    );
    return config;
}

/** Starts an owned registry and cleans failed setup before rejecting. */
export async function startRegistry(
    port = 0,
    startupMs = STARTUP_MS,
    signal = new AbortController().signal,
): Promise<Registry> {
    signal.throwIfAborted();
    const work = mkdtempSync(join(tmpdir(), 'gspot-release-'));
    try {
        const child = launch(await configure(work), port, signal);
        try {
            const url = await bounded(child.ready, startupMs, 'Registry startup timed out.');
            const npmrc = join(work, '.npmrc');
            writeFileSync(npmrc, `registry=${url}\n${url.replace('http:', '')}/:_authToken=fake\n`);
            return {
                url,
                npmrc,
                work,
                assertRunning: () => {
                    if (child.server.exitCode !== null || child.server.signalCode !== null) {
                        throw new Error('Registry is no longer running.');
                    }
                },
                stop: async () => {
                    const failures: unknown[] = [];
                    try {
                        await child.stop();
                    } catch (error) {
                        failures.push(error);
                    }
                    try {
                        rmSync(work, { recursive: true, force: true });
                    } catch (error) {
                        failures.push(error);
                    }
                    if (failures.length > 0) throw new AggregateError(failures, 'Registry cleanup failed.');
                },
            };
        } catch (error) {
            try {
                await child.stop();
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Registry startup and cleanup failed.');
            }
            const [stdout, stderr] = await child.output;
            throw new Error(`Registry startup failed.\n${stdout}\n${stderr}`, { cause: error });
        }
    } catch (error) {
        try {
            rmSync(work, { recursive: true, force: true });
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'Registry setup and storage cleanup failed.');
        }
        throw error;
    }
}

// Cleanup retains both errors when execution and registry shutdown fail independently.
export async function settleRegistry(registry: Registry, executionError: unknown): Promise<void> {
    let cleanupError: unknown;
    try {
        await registry.stop();
    } catch (error) {
        cleanupError = error;
    }
    if (executionError !== undefined && cleanupError !== undefined)
        throw new AggregateError([executionError, cleanupError], 'Registry execution and cleanup failed.');
    const failure: unknown = executionError ?? cleanupError;
    if (failure instanceof Error) throw failure;
    if (failure !== undefined) throw new Error(`Registry execution failed: ${JSON.stringify(failure)}`);
}
