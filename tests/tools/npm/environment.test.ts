import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runTool } from '#cli/tools/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';

test('native registry settings authenticate from an isolated project and preserve authored configuration', async () => {
    await using repository = await testdir();
    await using isolated = await testdir();
    const token = 'synthetic-registry-credential';
    const requests = { rejected: 0, authenticated: 0 };
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== `Bearer ${token}`) {
                requests.rejected++;
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            }
            requests.authenticated++;
            return Response.json({
                name: 'private-check-tool',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': { name: 'private-check-tool', version: '1.0.0' } },
            });
        },
    });
    try {
        const registry = `http://127.0.0.1:${String(server.port)}/`;
        await createFileTree(repository.path, {
            'package.json': '{"private":true}\n',
            '.npmrc': `registry=${registry}\n`,
        });
        await createFileTree(isolated.path, { 'package.json': '{"private":true}\n' });
        const command = [
            'npm',
            'view',
            'private-check-tool',
            'version',
            '--json',
            '--cache',
            join(isolated.path, 'cache'),
        ];
        const missing = await runTool(command, {
            cwd: isolated.path,
            env: await registryEnvironment(repository.path),
        });
        expect(missing.code).not.toBe(0);
        expect(requests.rejected).toBeGreaterThan(0);
        const source = `registry=${registry}\n//127.0.0.1:${String(server.port)}/:_authToken=${token}\n`;
        writeFileSync(join(repository.path, '.npmrc'), source, { mode: 0o600 });
        const mode = statSync(join(repository.path, '.npmrc')).mode;
        const corrected = await runTool(command, {
            cwd: isolated.path,
            env: await registryEnvironment(repository.path),
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
        expect(requests.authenticated).toBeGreaterThan(0);
        expect(corrected.stdout + corrected.stderr).not.toContain(token);
        expect(readFileSync(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(statSync(join(repository.path, '.npmrc')).mode).toBe(mode);
    } finally {
        await server.stop(true);
    }
});
