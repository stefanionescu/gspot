// Publishes the launcher and the platform package for this machine to a local verdaccio, installs them with --ignore-scripts, runs bunx gspot --version.
// Runs when GSPOT_RELEASE_TEST=1 (CI sets it); it needs a built binary under dist/ and a free port.
import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const enabled = process.env['GSPOT_RELEASE_TEST'] === '1';

async function waitFor(url: string, tries = 60): Promise<void> {
    for (let i = 0; i < tries; i += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // not up yet
        }
        await Bun.sleep(500);
    }
    throw new Error(`${url} did not come up`);
}

describe.skipIf(!enabled)('the npm launcher', () => {
    test('publishes to a local registry and runs from an install with --ignore-scripts', async () => {
        const port = 4873 + Math.floor(Math.random() * 1000);
        const registry = `http://localhost:${port}`;
        const work = mkdtempSync(join(tmpdir(), 'gspot-release-'));
        const storage = join(work, 'registry');
        const config = join(work, 'verdaccio.yaml');
        writeFileSync(
            config,
            (await Bun.file(join(root, 'tests', 'release', 'verdaccio.yaml')).text())
                .replace('./storage', join(storage, 'storage'))
                .replace('./htpasswd', join(storage, 'htpasswd')),
        );
        const server = Bun.spawn(['bunx', 'verdaccio', '--config', config, '--listen', String(port)], {
            cwd: root,
            stdout: 'ignore',
            stderr: 'ignore',
        });
        try {
            await waitFor(`${registry}/-/ping`);
            const npmrc = join(work, '.npmrc');
            writeFileSync(npmrc, `registry=${registry}\n//localhost:${port}/:_authToken=fake\n`);
            const publish = Bun.spawnSync(
                ['bun', 'packages/cli/publish.ts', '--tag', 'v0.1.0', '--registry', registry],
                { cwd: root, env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc }, stdout: 'pipe', stderr: 'pipe' },
            );
            expect(publish.exitCode).toBe(0);
            const install = join(work, 'install');
            writeFileSync(join(install, '..', 'package.json'), '{"name":"probe","private":true}\n');
            const added = Bun.spawnSync(
                [
                    'npm',
                    'install',
                    'gspot@0.1.0',
                    '--ignore-scripts',
                    '--registry',
                    registry,
                    '--no-audit',
                    '--no-fund',
                ],
                { cwd: work, env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc }, stdout: 'pipe', stderr: 'pipe' },
            );
            expect(added.exitCode).toBe(0);
            expect(existsSync(join(work, 'node_modules', 'gspot', 'gspot.js'))).toBe(true);
            const version = Bun.spawnSync(['npx', '--no-install', 'gspot', '--version'], {
                cwd: work,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(version.stdout.toString().trim()).toBe('0.1.0');
        } finally {
            server.kill();
            rmSync(work, { recursive: true, force: true });
        }
    });
});
