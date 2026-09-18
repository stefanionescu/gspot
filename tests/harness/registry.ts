// A verdaccio registry on a free port for the release tests, and the publish into it.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Registry } from '#types/run.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = new URL('../..', import.meta.url).pathname;
const BASE_PORT = 4873;
const PORT_SPREAD = 1000;
const POLL_MS = 500;
const POLL_TRIES = 60;

async function waitFor(url: string): Promise<void> {
    for (let index = 0; index < POLL_TRIES; index += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // not up yet
        }
        await Bun.sleep(POLL_MS);
    }
    throw new Error(`${url} did not come up`);
}

/**
 * Starts verdaccio in a temporary directory and waits until it answers.
 * @returns the registry: its url, the .npmrc that points at it, the work directory, and stop()
 */
export async function startRegistry(): Promise<Registry> {
    const port = BASE_PORT + (process.pid % PORT_SPREAD);
    const url = `http://localhost:${String(port)}`;
    const work = mkdtempSync(join(tmpdir(), 'gspot-release-'));
    const storage = join(work, 'registry');
    const config = join(work, 'verdaccio.yaml');
    const template = await Bun.file(join(root, 'tests', 'harness', 'verdaccio.yaml')).text();
    const storagePath = join(storage, 'storage');
    const passwordPath = join(storage, 'htpasswd');
    writeFileSync(
        config,
        template.replace('./storage', () => storagePath).replace('./htpasswd', () => passwordPath),
    );
    const npmrc = join(work, '.npmrc');
    writeFileSync(npmrc, `registry=${url}\n//localhost:${String(port)}/:_authToken=fake\n`);
    const server = Bun.spawn(['bunx', 'verdaccio', '--config', config, '--listen', String(port)], {
        cwd: root,
        stdout: 'ignore',
        stderr: 'ignore',
    });
    await waitFor(`${url}/-/ping`);
    return {
        url,
        npmrc,
        work,
        stop: () => {
            server.kill();
            rmSync(work, { recursive: true, force: true });
        },
    };
}

/**
 * Publishes the launcher and the platform packages from dist/ into a registry.
 * @param registry the registry
 * @returns the exit code of the publish script
 */
export function publishTo(registry: Registry): number {
    const result = Bun.spawnSync(['bun', 'packages/cli/publish.ts', '--tag', 'v0.1.0', '--registry', registry.url], {
        cwd: root,
        env: { ...environmentVariables(), NPM_CONFIG_USERCONFIG: registry.npmrc },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return result.exitCode;
}
