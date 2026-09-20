// An owned Verdaccio child with an isolated socket and storage for release tests.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Registry } from '#types/run.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const serverEntry = fileURLToPath(new URL('server.ts', import.meta.url));
const STARTUP_MS = 30_000;
const REQUEST_MS = 1000;
const SHUTDOWN_MS = 5000;

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

async function ping(url: string): Promise<void> {
    const response = await fetch(`${url}/-/ping`, { signal: AbortSignal.timeout(REQUEST_MS) });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Registry readiness failed: HTTP ${String(response.status)}.`);
}

function launch(config: string, port: number) {
    const address = Promise.withResolvers<number>();
    const server = Bun.spawn([process.execPath, serverEntry, config, String(port)], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
        ipc(packet: unknown) {
            if (typeof packet !== 'object' || packet === null || !('port' in packet)) return;
            if (typeof packet.port === 'number') address.resolve(packet.port);
        },
    });
    const output = Promise.all([new Response(server.stdout).text(), new Response(server.stderr).text()]);
    const exited = (async () => {
        const code = await server.exited;
        throw new Error(`Registry exited with status ${String(code)}.`);
    })();
    const ready = (async () => {
        const assignedPort = await Promise.race([address.promise, exited]);
        const url = `http://127.0.0.1:${String(assignedPort)}`;
        await Promise.race([ping(url), exited]);
        return url;
    })();
    async function stop(): Promise<void> {
        if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
        await bounded(server.exited, SHUTDOWN_MS, 'Registry shutdown timed out.');
        await output;
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
export async function startRegistry(port = 0, startupMs = STARTUP_MS): Promise<Registry> {
    const work = mkdtempSync(join(tmpdir(), 'gspot-release-'));
    try {
        const child = launch(await configure(work), port);
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
                    await child.stop();
                    rmSync(work, { recursive: true, force: true });
                },
            };
        } catch (error) {
            await child.stop();
            const [stdout, stderr] = await child.output;
            throw new Error(`Registry startup failed.\n${stdout}\n${stderr}`, { cause: error });
        }
    } catch (error) {
        rmSync(work, { recursive: true, force: true });
        throw error;
    }
}

/** Publishes built packages only while the owned registry is running. */
export function publishTo(registry: Registry): number {
    registry.assertRunning();
    const result = Bun.spawnSync(['bun', 'packages/cli/publish.ts', '--tag', 'v0.1.0', '--registry', registry.url], {
        cwd: root,
        env: { ...environmentVariables(), NPM_CONFIG_USERCONFIG: registry.npmrc },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return result.exitCode;
}
